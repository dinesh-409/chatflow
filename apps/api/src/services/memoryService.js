/**
 * memoryService.js
 * ---------------------------------------------------------
 * ChatFlow — Claude × Gemini Architecture
 * Memory System implementation
 * ---------------------------------------------------------
 */

import Memory from "../models/Memory.js";
import GlobalMemory from "../models/GlobalMemory.js";

/* =========================================================
   LAYER 1 — In-Process LRU Session Cache
========================================================= */
const SESSION_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;

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
        const oldest = [...SESSION_CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
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
export const classifyMessage = (text) => {
    const t = text.toLowerCase();

    if (/(password|api[\s_]?key|secret|token|sk-|bearer|ssn|credit[\s_]?card|cvv|otp|pin\b)/.test(t)) {
        return { privacy_level: "PRIVATE", relevance_score: 5 };
    }

    if (/(always\b|never\b|remember\b|my preference|i prefer|call me|my name is|i am called|remind me|in future)/.test(t)) {
        return { privacy_level: "GLOBAL", relevance_score: 10 };
    }

    return { privacy_level: "SEMI-SHARED", relevance_score: 1 };
};

/* =========================================================
   CORE — saveMessage
========================================================= */
export const saveMessage = async (sessionId, role, text, opts = {}) => {
    const { model = "auto", userId = "anonymous", intent = "" } = opts;
    const { privacy_level, relevance_score } = classifyMessage(text);

    const memory = await Memory.findOneAndUpdate(
        { sessionId },
        {
            $set: { userId },
            $inc: { messageCount: 1 },
            $push: {
                messages: {
                    $each: [{ role, text, metadata: { source_model: model, privacy_level, relevance_score, intent } }],
                    $slice: -20,
                },
            },
        },
        { new: true, upsert: true }
    );

    _cacheDel(sessionId);

    if (privacy_level === "GLOBAL") {
        await GlobalMemory.findOneAndUpdate(
            { userId },
            {
                $push: {
                    globalMessages: {
                        $each: [{ role, text, sessionId, createdAt: new Date() }],
                        $slice: -50,
                    },
                },
            },
            { upsert: true }
        );
    }

    return memory;
};

export const addMessage = (sessionId, role, text, model = "auto") => saveMessage(sessionId, role, text, { model });

/* =========================================================
   CORE — getChatHistory
========================================================= */
export const getChatHistory = async (sessionId, limit = 20) => {
    const cached = _cacheGet(sessionId);
    if (cached) return cached.slice(-limit);

    const memory = await Memory.findOne({ sessionId }).lean();
    if (!memory) return [];

    _cacheSet(sessionId, memory.messages || []);
    return (memory.messages || []).slice(-limit);
};

export const getMemory = async (sessionId) => {
    const cached = _cacheGet(sessionId);
    if (cached) return { sessionId, messages: cached };

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
export const getRelevantMemory = async (sessionId, currentQuery = "", limit = 5) => {
    const messages = await getChatHistory(sessionId, 40);

    if (!currentQuery || messages.length === 0) {
        return messages.slice(-limit);
    }

    const queryWords = new Set(currentQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    const scored = messages
        .filter(m => m.metadata?.privacy_level !== "PRIVATE")
        .map((m, idx) => {
            const words = m.text.toLowerCase().split(/\s+/);
            const overlap = words.filter(w => queryWords.has(w)).length;
            const recency = idx / messages.length;
            const score = overlap * 2 + recency;
            return { ...m, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored;
};

/* =========================================================
   CORE — getGlobalMemory
========================================================= */
export const getGlobalMemory = async (currentSessionId, userId = "anonymous") => {
    const allMemories = await Memory.find({
        sessionId: { $ne: currentSessionId },
        ...(userId !== "anonymous" ? { userId } : {}),
    }).sort({ updatedAt: -1 }).limit(5).lean();

    let globalContext = "";

    for (const mem of allMemories) {
        const validMsgs = (mem.messages || []).filter(m => !m.metadata || m.metadata.privacy_level !== "PRIVATE");
        const lastMsgs = validMsgs.slice(-4).map(m => `${m.role}: ${m.text}`).join("\n");
        if (lastMsgs) globalContext += `[From a past chat]:\n${lastMsgs}\n\n`;
    }

    const globalMem = await GlobalMemory.findOne({ userId }).lean();
    if (globalMem?.preferences?.length) {
        const prefs = globalMem.preferences.map(p => `${p.key}: ${p.value}`).join(", ");
        globalContext = `[User Preferences]: ${prefs}\n\n` + globalContext;
    }

    return globalContext.trim();
};

/* =========================================================
   CORE — injectMemoryToPrompt
========================================================= */
export const injectMemoryToPrompt = async (basePrompt, sessionId, currentQuery = "", userId = "anonymous") => {
    // Fetch ONLY local last 5 messages as requested
    const history = await getChatHistory(sessionId, 5);
    
    let contextSummary = "";

    if (history.length > 0) {
        contextSummary = history.map(m => {
            const roleName = m.role === "user" ? "User" : "AI";
            return `${roleName}: ${m.text}`;
        }).join("\n");
    }

    const enrichedPrompt = contextSummary ? `${basePrompt}\n\n${contextSummary}` : basePrompt;

    return { enrichedPrompt, contextSummary };
};