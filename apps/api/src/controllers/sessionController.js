import Session from "../models/Session.js";
import Memory from "../models/Memory.js";

/* =========================
   GET ALL SESSIONS
========================= */

export const getAllSessions = async (
    req,
    res
) => {
    try {

        const sessions =
            await Session.find({
                userId: req.user.id,
                isArchived: false,
            })
                .sort({
                    isPinned: -1,
                    updatedAt: -1,
                    createdAt: -1,
                })
                .lean();

        const validSessions = [];

        for (const session of sessions) {

            if (
                session.title &&
                session.title !== "New Chat"
            ) {
                validSessions.push(session);
                continue;
            }

            const memory =
                await Memory.findOne({
                    sessionId:
                        session.sessionId,
                })
                    .select("messages")
                    .lean();

            if (
                memory?.messages?.length >
                0
            ) {
                validSessions.push(
                    session
                );
            }
            else {

                await Session.deleteOne({
                    _id: session._id,
                });
            }
        }

        return res.json(
            validSessions
        );
    }
    catch (err) {

        console.error(
            "getAllSessions error:",
            err
        );

        return res.status(500).json({
            error:
                "Failed to load sessions",
        });
    }
};

/* =========================
   GET SINGLE SESSION
========================= */

export const getSession = async (
    req,
    res
) => {
    try {

        const sessionId =
            req.params.id;

        const session =
            await Session.findOne({
                sessionId,
                userId: req.user.id,
            }).lean();

        if (!session) {

            return res.status(404).json({
                error:
                    "Session not found",
            });
        }

        const memory =
            await Memory.findOne({
                sessionId,
            })
                .select("messages")
                .lean();

        return res.json({
            session,
            messages:
                memory?.messages || [],
        });
    }
    catch (err) {

        console.error(
            "getSession error:",
            err
        );

        return res.status(500).json({
            error:
                "Failed to load session",
        });
    }
};

/* =========================
   UPDATE SESSION
========================= */

export const updateSession =
    async (req, res) => {
        try {

            const {
                title,
                isPinned,
                isArchived,
            } = req.body;

            const updateData = {};

            if (
                title !== undefined
            ) {
                updateData.title =
                    title.trim();
            }

            if (
                isPinned !== undefined
            ) {
                updateData.isPinned =
                    Boolean(isPinned);
            }

            if (
                isArchived !== undefined
            ) {
                updateData.isArchived =
                    Boolean(
                        isArchived
                    );
            }

            const session =
                await Session.findOneAndUpdate(
                    {
                        sessionId:
                            req.params.id,
                        userId:
                            req.user.id,
                    },
                    {
                        $set:
                            updateData,
                    },
                    {
                        new: true,
                    }
                );

            if (!session) {

                return res.status(
                    404
                ).json({
                    error:
                        "Session not found",
                });
            }

            return res.json(
                session
            );
        }
        catch (err) {

            console.error(
                "updateSession error:",
                err
            );

            return res.status(
                500
            ).json({
                error:
                    "Failed to update session",
            });
        }
    };

/* =========================
   DELETE SESSION
========================= */

export const deleteSession =
    async (req, res) => {
        try {

            const sessionId =
                req.params.id;

            const session =
                await Session.findOneAndDelete(
                    {
                        sessionId,
                        userId:
                            req.user.id,
                    }
                );

            if (!session) {

                return res.status(
                    404
                ).json({
                    error:
                        "Session not found",
                });
            }

            await Memory.deleteMany({
                sessionId,
            });

            return res.json({
                success: true,
            });
        }
        catch (err) {

            console.error(
                "deleteSession error:",
                err
            );

            return res.status(
                500
            ).json({
                error:
                    "Failed to delete session",
            });
        }
    };