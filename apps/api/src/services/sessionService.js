import Session from "../models/Session.js";

/* =========================
   CREATE SESSION
========================= */
export const createSession = async (
    sessionId,
    userId
) => {
    if (!sessionId || !userId) {
        throw new Error(
            "sessionId and userId are required"
        );
    }

    const session =
        await Session.findOneAndUpdate(
            {
                sessionId,
                userId,
            },
            {
                $setOnInsert: {
                    sessionId,
                    userId,
                    title: "New Chat",
                    isPinned: false,
                    isArchived: false,
                },
            },
            {
                new: true,
                upsert: true,
            }
        );

    return session;
};

/* =========================
   GET USER SESSIONS
========================= */
export const getAllSessions =
    async (userId) => {
        if (!userId) {
            return [];
        }

        return await Session.find({
            userId,
            isArchived: false,
        })
            .sort({
                isPinned: -1,
                updatedAt: -1,
                createdAt: -1,
            })
            .lean();
    };