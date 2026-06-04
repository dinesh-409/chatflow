import Memory from "../models/Memory.js";

// GET MEMORY
export const getMemory = async (sessionId) => {
    let memory = await Memory.findOne({ sessionId });

    if (!memory) {
        memory = await Memory.create({
            sessionId,
            messages: []
        });
    }

    return memory;
};

// ADD MESSAGE
export const addMessage = async (sessionId, role, text) => {
    const memory = await getMemory(sessionId);

    memory.messages.push({ role, text });

    // keep only last 20 messages (IMPORTANT)
    if (memory.messages.length > 20) {
        memory.messages = memory.messages.slice(-20);
    }

    await memory.save();
    return memory;
};