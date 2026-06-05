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