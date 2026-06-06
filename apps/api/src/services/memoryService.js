/**
 * memoryService.js
 * ---------------------------------------------------------
 * ChatFlow Phase 3 — Memory System
 *
 * Provides:
 *   saveMessage(sessionId, role, text, opts)
 *   getChatHistory(sessionId, limit?)
 *   getRelevantMemory(sessionId, currentQuery?)
 *   getGlobalMemory(currentSessionId, userId?)   [existing callers preserved]
 *   addMessage(...)                              [backward-compat alias]
 *   getMemory(sessionId)                         [backward-compat]
 *   injectMemoryToPrompt(basePrompt, sessionId, userId?)
 *
 * Architecture:
 *   Layer 1 — In-process LRU cache (no Redis dependency needed right now)
 *   Layer 2 — MongoDB (Memory model per session)
 *   Layer 3 — GlobalMemory model (cross-session user preferences)
 *
 * Redis note:
 *   The cache layer below is built as a drop-in interface.
 *   When you add Redis, replace _cacheGet/_cacheSet/_cacheDel
 *   with ioredis calls — nothing else changes.
 * ---------------------------------------------------------
 */

import Memory       from "../models/Memory.js";
import GlobalMemory from "../models/GlobalMemory.js";

/* =========================================================
   LAYER 1 — In-Process LRU Session Cache
   (swap internals for Redis without changing API)
========================================================= */
const SESSION_CACHE = new Map();   // sessionId -> { messages, ts }
const CACHE_TTL_MS  = 5 * 60 * 1000;   // 5 minutes
const CACHE_MAX     = 200;              // max sessions in memory

function _cacheGet(sessionId) {
    const entry = SESSION_CACHE.get(sessionId);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        SESSION_CACHE.delete(sessionId);
        return null;
    }
    return entry.data;
}

function _cacheSet(sessionId, data) {
    if (SESSION_CACHE.size >= CACHE_MAX) {
        // Evict oldest
        const oldest = [...SESSION_CACHE.entries()]
            .sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) SESSION_CACHE.delete(oldest[0]);
    }
    SESSION_CACHE.set(sessionId, { data, ts: Date.now() });
}

function _cacheDel(sessionId) {
    SESSION_CACHE.delete(sessionId);
}

/* =========================================================
   PRIVACY + CLASSIFICATION
========================================================= */

/**
 * classifyMessage(text) -> { privacy_level, relevance_score, intent }
 */
export const classifyMessage = (text) => {
    const t = text.toLowerCase();

    // PRIVATE — never leave this session or inject into global
    if (/(password|api[\s_]?key|secret|token|sk-|bearer|ssn|credit[\s_]?card|cvv|otp|pin\b)/.test(t)) {
        return { privacy_level: "PRIVATE", relevance_score: 5, intent: "security" };
    }

    // GLOBAL — user preferences & persistent facts (inject to all future chats)
    if (/(always\b|never\b|remember\b|my preference|i prefer|call me|my name is|i am called|remind me|in future)/.test(t)) {
        return { privacy_level: "GLOBAL", relevance_score: 10, intent: "preference" };
    }

    // Default: SEMI-SHARED (visible in global context from past sessions)
    return { privacy_level: "SEMI-SHARED", relevance_score: 1, intent: "" };
};

/* =========================================================
   CORE — saveMessage / getChatHistory
========================================================= */

/**
 * saveMessage(sessionId, role, text, opts?)
 *
 * Persists one message to MongoDB + updates cache.
 * Optionally stores GLOBAL messages in GlobalMemory.
 *
 * @param {string} sessionId
 * @param {"user"|"ai"|"system"} role
 * @param {string} text
 * @param {{ model?: string, userId?: string, intent?: string }} opts
 */
export const saveMessage = async (sessionId, role, text, opts = {}) => {
    const { model = "auto", userId = "anonymous", intent = "" } = opts;
    const { privacy_level, relevance_score } = classifyMessage(text);

    // Persist to MongoDB (keep last 20 messages per session)
    const memory = await Memory.findOneAndUpdate(
        { sessionId },
        {
            $set      : { userId },
            $inc      : { messageCount: 1 },
            $push     : {
                messages: {
                    $each : [{ role, text, metadata: { source_model: model, privacy_level, relevance_score, intent } }],
                    $slice: -20,
                },
            },
        },
        { new: true, upsert: true }
    );

    // Invalidate cache so next read is fresh
    _cacheDel(sessionId);

    // Promote GLOBAL messages to GlobalMemory
    if (privacy_level === "GLOBAL") {
        await GlobalMemory.findOneAndUpdate(
            { userId },
            {
                $push: {
                    globalMessages: {
                        $each : [{ role, text, sessionId, createdAt: new Date() }],
                        $slice: -50,   // keep last 50 global messages
                    },
                },
            },
            { upsert: true }
        );
    }

    return memory;
};

/**
 * Backward-compatible alias used by existing callers.
 */
export const addMessage = (sessionId, role, text, model = "auto") =>
    saveMessage(sessionId, role, text, { model });

/* =========================================================
   CORE — getChatHistory
========================================================= */

/**
 * getChatHistory(sessionId, limit?)
 * Returns last N messages for a session (cache-first).
 *
 * @param {string} sessionId
 * @param {number} limit — default 20
 * @returns {Array<{role, text, metadata}>}
 */
export const getChatHistory = async (sessionId, limit = 20) => {
    const cached = _cacheGet(sessionId);
    if (cached) return cached.slice(-limit);

    const memory = await Memory.findOne({ sessionId }).lean();
    if (!memory) return [];

    _cacheSet(sessionId, memory.messages || []);
    return (memory.messages || []).slice(-limit);
};

/**
 * Backward-compatible getMemory — returns full Memory document.
 */
export const getMemory = async (sessionId) => {
    const cached = _cacheGet(sessionId);
    if (cached) {
        // Rebuild minimal doc shape callers expect
        return { sessionId, messages: cached };
    }

    const memory = await Memory.findOneAndUpdate(
        { sessionId },
        { $setOnInsert: { sessionId, messages: [] } },
        { new: true, upsert: true }
    );

    _cacheSet(sessionId, memory.messages || []);
    return memory;
};

/* =========================================================
   CORE — getRelevantMemory
========================================================= */

/**
 * getRelevantMemory(sessionId, currentQuery?, limit?)
 *
 * Returns the most contextually relevant past messages
 * for a given query (keyword overlap scoring).
 *
 * @param {string}  sessionId
 * @param {string}  currentQuery — optional, used for relevance ranking
 * @param {number}  limit        — max messages to return
 * @returns {Array<{role, text, score}>}
 */
export const getRelevantMemory = async (sessionId, currentQuery = "", limit = 6) => {
    const messages = await getChatHistory(sessionId, 40);

    if (!currentQuery || messages.length === 0) {
        return messages.slice(-limit);
    }

    const queryWords = new Set(
        currentQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    // Score each message by keyword overlap + recency
    const scored = messages
        .filter(m => m.metadata?.privacy_level !== "PRIVATE")
        .map((m, idx) => {
            const words  = m.text.toLowerCase().split(/\s+/);
            const overlap = words.filter(w => queryWords.has(w)).length;
            const recency = idx / messages.length;          // 0 (oldest) → 1 (newest)
            const score   = overlap * 2 + recency;
            return { ...m, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored;
};

/* =========================================================
   CORE — getGlobalMemory (cross-session context)
========================================================= */

/**
 * getGlobalMemory(currentSessionId, userId?)
 *
 * Returns a formatted string of global context from past sessions.
 * Backward-compatible with existing chatController callers.
 *
 * @param {string} currentSessionId
 * @param {string} userId
 * @returns {string}
 */
export const getGlobalMemory = async (currentSessionId, userId = "anonymous") => {
    // 1. Recent cross-session SEMI-SHARED context (last 5 sessions)
    const allMemories = await Memory.find({
        sessionId     : { $ne: currentSessionId },
        ...(userId !== "anonymous" ? { userId } : {}),
    })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

    let globalContext = "";

    for (const mem of allMemories) {
        const validMsgs = (mem.messages || []).filter(
            m => !m.metadata || m.metadata.privacy_level !== "PRIVATE"
        );
        const lastMsgs = validMsgs
            .slice(-4)
            .map(m => `${m.role}: ${m.text}`)
            .join("\n");
        if (lastMsgs) {
            globalContext += `[From a past chat]:\n${lastMsgs}\n\n`;
        }
    }

    // 2. User preferences from GlobalMemory
    const globalMem = await GlobalMemory.findOne({ userId }).lean();
    if (globalMem?.preferences?.length) {
        const prefs = globalMem.preferences
            .map(p => `${p.key}: ${p.value}`)
            .join(", ");
        globalContext = `[User Preferences]: ${prefs}\n\n` + globalContext;
    }

    return globalContext.trim();
};

/* =========================================================
   CORE — injectMemoryToPrompt
========================================================= */

/**
 * injectMemoryToPrompt(basePrompt, sessionId, userId?)
 *
 * Enriches a prompt string with:
 *   - User preferences (from GlobalMemory)
 *   - Recent session context (last 10 messages)
 *   - Relevant past messages (scored by query overlap)
 *
 * @param {string} basePrompt     — the system prompt template
 * @param {string} sessionId
 * @param {string} currentQuery   — used for relevance scoring
 * @param {string} userId
 * @returns {{ enrichedPrompt: string, contextSummary: string }}
 */
export const injectMemoryToPrompt = async (
    basePrompt,
    sessionId,
    currentQuery = "",
    userId = "anonymous"
) => {
    // Gather all memory layers in parallel
    const [history, relevantMsgs, globalCtx] = await Promise.all([
        getChatHistory(sessionId, 10),
        getRelevantMemory(sessionId, currentQuery, 5),
        getGlobalMemory(sessionId, userId),
    ]);

    // Format recent session context
    const recentContext = history
        .map(m => `${m.role}: ${m.text}`)
        .join("\n");

    // Format relevant past context (deduplicate vs. recent)
    const recentTexts = new Set(history.map(m => m.text));
    const relevantContext = relevantMsgs
        .filter(m => !recentTexts.has(m.text))
        .map(m => `${m.role}: ${m.text}`)
        .join("\n");

    const contextSummary = [
        globalCtx       ? `[Global Context]\n${globalCtx}`         : "",
        relevantContext ? `[Relevant Past Context]\n${relevantContext}` : "",
        recentContext   ? `[Recent Conversation]\n${recentContext}`  : "",
    ].filter(Boolean).join("\n\n");

    const enrichedPrompt = `${basePrompt}

--- MEMORY CONTEXT ---
${contextSummary || "No prior context available."}
--- END MEMORY CONTEXT ---`;

    return { enrichedPrompt, contextSummary };
};