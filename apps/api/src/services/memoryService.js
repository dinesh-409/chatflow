import Memory from "../models/Memory.js";

// GET MEMORY
export const getMemory = async (sessionId) => {
    const memory = await Memory.findOneAndUpdate(
        { sessionId },
        { $setOnInsert: { sessionId, messages: [] } },
        { new: true, upsert: true }
    );
    return memory;
};

export const classifyMessage = (text) => {
    const textLower = text.toLowerCase();
    
    // PRIVATE: passwords, tokens, API keys, personal IDs
    if (/(password|api key|secret|token|sk-|bearer|ssn|credit card|cvv)/.test(textLower)) {
        return { privacy_level: "PRIVATE", relevance_score: 5 };
    }
    
    // GLOBAL: preferences, system rules, "always do this", "remember this"
    if (/(always|never|remember|my preference|prefer|call me|my name is)/.test(textLower)) {
        return { privacy_level: "GLOBAL", relevance_score: 10 };
    }
    
    // Default: SEMI-SHARED
    return { privacy_level: "SEMI-SHARED", relevance_score: 1 };
};

// ADD MESSAGE
export const addMessage = async (sessionId, role, text, model = "auto") => {
    const { privacy_level, relevance_score } = classifyMessage(text);
    const memory = await Memory.findOneAndUpdate(
        { sessionId },
        { 
            $push: { 
                messages: { 
                    $each: [{ 
                        role, 
                        text,
                        metadata: { source_model: model, privacy_level, relevance_score }
                    }], 
                    $slice: -20 
                } 
            } 
        },
        { new: true, upsert: true }
    );
    return memory;
};

// GET GLOBAL MEMORY
export const getGlobalMemory = async (currentSessionId) => {
    // Fetch the 5 most recently updated memory sessions (excluding the current one)
    const allMemories = await Memory.find({ sessionId: { $ne: currentSessionId } })
        .sort({ updatedAt: -1, _id: -1 })
        .limit(5);

    let globalContext = "";
    allMemories.forEach(mem => {
        // Filter out PRIVATE data across chats
        const validMsgs = mem.messages.filter(m => !m.metadata || m.metadata.privacy_level !== "PRIVATE");
        
        // Extract the last 4 valid messages
        const lastMsgs = validMsgs.slice(-4).map(m => `${m.role}: ${m.text}`).join("\n");
        if (lastMsgs) {
            globalContext += `[From a past chat]:\n${lastMsgs}\n\n`;
        }
    });

    return globalContext.trim();
};