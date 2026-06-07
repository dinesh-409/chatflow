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
   PRIVACY + CLASSIFICATION + EXTRACTION
========================================================= */
export const classifyAndExtractMemory = (text) => {
    const t = text.toLowerCase();
    const result = {
        privacy_level: "SEMI-SHARED",
        relevance_score: 1,
        extracted: [] // Array of { type, content }
    };

    // 0. Privacy filters
    if (/(password|api[\s_]?key|secret|token|sk-|bearer|ssn|credit[\s_]?card|cvv|otp|pin\b)/.test(t)) {
        result.privacy_level = "PRIVATE";
        result.relevance_score = 5;
        return result; // Don't extract private data
    }

    // 1. Profile Memory
    const nameMatch = text.match(/(?:my name is|i am) ([a-zA-Z\s]+)/i) || text.match(/i am called ([a-zA-Z\s]+)/i);
    if (nameMatch && !t.includes("building") && !t.includes("studying") && nameMatch[1].split(" ").length < 4) {
        result.extracted.push({ type: "profile", content: `Name: ${nameMatch[1].trim()}` });
        result.privacy_level = "GLOBAL";
    }

    // 2. Preference Memory
    if (/(always\b|never\b|prefer\b|preference\b|make sure you\b|respond with\b)/.test(t)) {
        result.extracted.push({ type: "preferences", content: text });
        result.privacy_level = "GLOBAL";
    }

    // 3. Project Memory
    const projectMatch = text.match(/i am (?:building|working on|creating|developing) ([a-zA-Z0-9\s]+)/i);
    if (projectMatch) {
        result.extracted.push({ type: "projects", content: `Working on: ${projectMatch[1].trim()}` });
        result.privacy_level = "GLOBAL";
    }

    // 4. Educational Memory
    const eduMatch = text.match(/i (?:study|learn|am studying|am learning) ([a-zA-Z0-9\s&]+)/i);
    if (eduMatch) {
        result.extracted.push({ type: "education", content: `Studies: ${eduMatch[1].trim()}` });
        result.privacy_level = "GLOBAL";
    }

    // 5. User Goal Tracking
    const goalMatch = text.match(/(?:my goal is|i want to achieve|i am trying to) (.+)/i);
    if (goalMatch) {
        result.extracted.push({ type: "goals", content: `Goal: ${goalMatch[1].trim()}` });
        result.privacy_level = "GLOBAL";
    }

    // 6. Long-Term Memory (General persistent facts)
    if (/(remember that|keep in mind|fact:|note that)/.test(t)) {
        result.extracted.push({ type: "longTermFacts", content: text });
        result.privacy_level = "GLOBAL";
    }

    if (result.privacy_level === "GLOBAL") {
        result.relevance_score = 10;
    } else if (/(always\b|never\b|remember\b|my preference|i prefer|call me|my name is|i am called|remind me|in future)/.test(t)) {
        // Fallback catch-all for old global trigger words
        result.privacy_level = "GLOBAL";
        result.relevance_score = 10;
    }

    return result;
};

/* =========================================================
   CORE — saveMessage
========================================================= */
export const saveMessage = async (sessionId, role, text, opts = {}) => {
    const { model = "auto", userId = "anonymous", intent = "" } = opts;
    
    const { privacy_level, relevance_score, extracted } = role === "user" 
        ? classifyAndExtractMemory(text) 
        : { privacy_level: "SEMI-SHARED", relevance_score: 1, extracted: [] };

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

    if (privacy_level === "GLOBAL" && userId !== "anonymous") {
        const updateOps = { $push: { globalMessages: { $each: [{ role, text, sessionId, createdAt: new Date() }], $slice: -50 } } };
        
        for (const item of extracted) {
            updateOps.$addToSet = updateOps.$addToSet || {};
            updateOps.$addToSet[item.type] = item.content;
        }

        await GlobalMemory.findOneAndUpdate(
            { userId },
            updateOps,
            { upsert: true }
        );
    }

    return memory;
};

export const addMessage = (sessionId, role, text, model = "auto") => saveMessage(sessionId, role, text, { model });

/* =========================================================
   CORE — truncateHistory
========================================================= */
export const truncateHistory = async (sessionId, keepCount) => {
    if (keepCount == null || keepCount < 0) return;
    
    const memory = await Memory.findOne({ sessionId });
    if (!memory || !memory.messages) return;

    if (memory.messages.length > keepCount) {
        memory.messages = memory.messages.slice(0, keepCount);
        memory.messageCount = memory.messages.length;
        await memory.save();
    }
    
    _cacheDel(sessionId);
};

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

    const queryTokens = currentQuery.toLowerCase().match(/\w+/g) || [];
    const queryWords = new Set(queryTokens.filter(w => w.length > 3));

    const scored = messages
        .filter(m => m.metadata?.privacy_level !== "PRIVATE")
        .map((m, idx) => {
            const words = (m.text.toLowerCase().match(/\w+/g) || []).filter(w => w.length > 3);
            let overlap = 0;
            for (const w of words) {
                if (queryWords.has(w)) overlap++;
            }
            const recency = idx / messages.length;
            const score = (overlap * 2) + recency;
            return { ...m, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored;
};

/* =========================================================
   CORE — getGlobalMemory
========================================================= */
export const getGlobalMemory = async (currentSessionId, userId = "anonymous", currentQuery = "") => {
    const globalMem = await GlobalMemory.findOne({ userId }).lean();
    let globalContext = "";

    if (globalMem) {
        const q = currentQuery.toLowerCase();
        const queryTokens = new Set(q.match(/[a-z0-9]+/g) || []);

        // MEMORY RELEVANCE RANKING HELPER
        // Token overlap scoring for individual memory items to inject only the most relevant ones.
        const rankMemories = (memories, threshold = 0) => {
            if (!memories || memories.length === 0) return [];
            return memories.map(mem => {
                let score = 0;
                const memTokens = typeof mem === "string" ? mem.toLowerCase().match(/[a-z0-9]+/g) || [] : [];
                for (const t of memTokens) if (queryTokens.has(t)) score++;
                return { mem, score };
            }).filter(item => item.score >= threshold)
              .sort((a, b) => b.score - a.score)
              .map(item => item.mem);
        };

        // 1. Preferences are ALWAYS relevant
        if (globalMem.preferences?.length) globalContext += `<preference_memory>\n${globalMem.preferences.map(p => typeof p === "string" ? p : `${p.key}: ${p.value}`).join("\n")}\n</preference_memory>\n`;
        // 2. Profile is relevant if asking about identity
        if (globalMem.profile?.length && /(who am i|my name|about me|profile)/.test(q)) globalContext += `<profile_memory>\n${globalMem.profile.join("\n")}\n</profile_memory>\n`;
        // 3. Projects are relevant if asking about building, projects, or work
        if (globalMem.projects?.length && /(project|build|work|create|develop|code|app)/.test(q)) {
            const relevantProjects = rankMemories(globalMem.projects, 0).slice(0, 3); // Inject top 3
            if (relevantProjects.length) globalContext += `<project_memory>\n${relevantProjects.join("\n")}\n</project_memory>\n`;
        }
        // 4. Education is relevant if asking about study, learn, course
        if (globalMem.education?.length && /(study|learn|course|degree|college|university)/.test(q)) {
            const relevantEdu = rankMemories(globalMem.education, 0).slice(0, 3); // Inject top 3
            if (relevantEdu.length) globalContext += `<educational_memory>\n${relevantEdu.join("\n")}\n</educational_memory>\n`;
        }
        // 5. Goals are relevant if asking about goals, achieving, trying
        if (globalMem.goals?.length && /(goal|achieve|trying to|want to|plan)/.test(q)) {
            const relevantGoals = rankMemories(globalMem.goals, 0).slice(0, 3); // Inject top 3
            if (relevantGoals.length) globalContext += `<goal_memory>\n${relevantGoals.join("\n")}\n</goal_memory>\n`;
        }
        // 6. Long-term facts are always relevant as foundational knowledge
        if (globalMem.longTermFacts?.length) globalContext += `<long_term_memory>\n${globalMem.longTermFacts.join("\n")}\n</long_term_memory>\n`;
    }

    // LONG-TERM CONVERSATION CONTINUITY
    const allMemories = await Memory.find({
        sessionId: { $ne: currentSessionId },
        ...(userId !== "anonymous" ? { userId } : {}),
    }).sort({ updatedAt: -1 }).limit(5).lean();

    for (const mem of allMemories) {
        const validMsgs = (mem.messages || []).filter(m => !m.metadata || m.metadata.privacy_level !== "PRIVATE");
        const lastMsgs = validMsgs.slice(-4).map(m => `${m.role}: ${m.text}`).join("\n");
        if (lastMsgs) globalContext += `<past_conversation>\n${lastMsgs}\n</past_conversation>\n`;
    }

    return globalContext ? `<global_memory>\n${globalContext.trim()}\n</global_memory>` : "";
};

/* =========================================================
   CORE — injectMemoryToPrompt
========================================================= */
export const injectMemoryToPrompt = async (basePrompt, sessionId, currentQuery = "", userId = "anonymous") => {
    // Fetch local history (limit 20 to allow compression) and global cross-chat memory
    const [history, globalCtx] = await Promise.all([
        getChatHistory(sessionId, 20),
        getGlobalMemory(sessionId, userId, currentQuery)
    ]);
    
    let contextSummary = "";

    if (globalCtx) {
        contextSummary += `${globalCtx}\n\n`;
    }

    if (history.length > 0) {
        contextSummary += `<chat_history>\n`;
        
        // CONTEXT COMPRESSION:
        // Keep the last 4 messages verbatim.
        // For older messages, truncate to 150 chars to preserve high-level context without token bloat.
        const recentCount = 4;
        const cutoff = Math.max(0, history.length - recentCount);
        
        contextSummary += history.map((m, idx) => {
            const roleName = m.role === "user" ? "User" : "AI";
            let text = m.text;
            if (idx < cutoff && text.length > 150) {
                text = text.substring(0, 147) + "... [compressed]";
            }
            return `${roleName}: ${text}`;
        }).join("\n\n");
        
        contextSummary += `\n</chat_history>\n\n`;
    }

    const enrichedPrompt = contextSummary ? `${basePrompt}\n\n${contextSummary}` : basePrompt;

    return { enrichedPrompt, contextSummary };
};