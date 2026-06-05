import express from "express";
import Session from "../models/Session.js";
import Memory from "../models/Memory.js";

const router = express.Router();

/* =========================
   GET ALL SESSIONS
========================= */

router.get("/sessions", async (req, res) => {
    try {
        const sessions = await Session.find({})
            .sort({ createdAt: -1 });

        res.json(sessions);
    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

/* =========================
   GET SINGLE SESSION
========================= */

router.get("/sessions/:id", async (req, res) => {
    try {
        const memory = await Memory.findOne({
            sessionId: req.params.id,
        });

        if (!memory) {
            return res.json({
                messages: [],
            });
        }

        res.json({
            messages: memory.messages,
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

export default router;