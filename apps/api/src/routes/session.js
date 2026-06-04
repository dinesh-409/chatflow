import express from "express";
import { createSession, getAllSessions } from "../services/sessionService.js";

const router = express.Router();

// create session
router.post("/session", async (req, res) => {
    const { sessionId } = req.body;
    const session = await createSession(sessionId);
    res.json(session);
});

// get all sessions
router.get("/sessions", async (req, res) => {
    const sessions = await getAllSessions();
    res.json(sessions);
});

import { getMemory } from "../services/memoryService.js";

// get session history
router.get("/session/:sessionId", async (req, res) => {
    try {
        const memory = await getMemory(req.params.sessionId);
        res.json(memory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;