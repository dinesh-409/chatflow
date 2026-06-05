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

// ADD MESSAGE
export const addMessage = async (sessionId, role, text) => {
    const memory = await Memory.findOneAndUpdate(
        { sessionId },
        { 
            $push: { 
                messages: { 
                    $each: [{ role, text }], 
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
        // Extract the last 4 messages from each to avoid blowing up the token limit
        const lastMsgs = mem.messages.slice(-4).map(m => `${m.role}: ${m.text}`).join("\n");
        if (lastMsgs) {
            globalContext += `[From a past chat]:\n${lastMsgs}\n\n`;
        }
    });

    return globalContext.trim();
};