import Session from "../models/Session.js";

export const createSession = async (sessionId, userId) => {
    const exists = await Session.findOneAndUpdate(
        { sessionId, userId },
        { $setOnInsert: { sessionId, userId, title: "New Chat" } },
        { new: true, upsert: true }
    );

    return exists;
};

export const getAllSessions = async () => {
    return await Session.find().sort({ createdAt: -1 });
};