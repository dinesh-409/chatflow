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
            .sort({ isPinned: -1, updatedAt: -1, createdAt: -1 });
            
        // Filter out empty "New Chat" sessions dynamically
        const validSessions = [];
        for (const session of sessions) {
            if (session.title !== "New Chat") {
                validSessions.push(session);
                continue;
            }
            const memory = await Memory.findOne({ sessionId: session.sessionId });
            if (memory && memory.messages && memory.messages.length > 0) {
                validSessions.push(session);
            } else {
                // Delete orphaned empty session
                await Session.deleteOne({ _id: session._id });
            }
        }

        res.json(validSessions);
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

/* =========================
   UPDATE SESSION (Rename, Pin, Archive)
========================= */

router.put("/sessions/:id", async (req, res) => {
    try {
        const { title, isPinned, isArchived } = req.body;
        
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (isPinned !== undefined) updateData.isPinned = isPinned;
        if (isArchived !== undefined) updateData.isArchived = isArchived;
        
        const session = await Session.findOneAndUpdate(
            { sessionId: req.params.id },
            { $set: updateData },
            { new: true }
        );
        
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   DELETE SESSION
========================= */

router.delete("/sessions/:id", async (req, res) => {
    try {
        await Session.findOneAndDelete({ sessionId: req.params.id });
        await Memory.findOneAndDelete({ sessionId: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;