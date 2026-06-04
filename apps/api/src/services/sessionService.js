import Session from "../models/Session.js";

export const createSession = async (sessionId) => {
    const exists = await Session.findOne({ sessionId });

    if (!exists) {
        return await Session.create({
            sessionId,
            title: "New Chat",
        });
    }

    return exists;
};

export const getAllSessions = async () => {
    return await Session.find().sort({ createdAt: -1 });
};