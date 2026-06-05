import express from "express";
import Session from "../models/Session.js";

const router = express.Router();

/* GET ALL SESSIONS */

router.get("/sessions", async (req, res) => {
    try {
        const sessions = await Session.find({})
            .sort({ updatedAt: -1 });

        res.json(sessions);
    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

/* GET SINGLE SESSION */

router.get("/sessions/:id", async (req, res) => {
    try {
        const session = await Session.findOne({
            sessionId: req.params.id,
        });

        if (!session) {
            return res.json({
                messages: [],
            });
        }

        res.json(session);
    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

export default router;