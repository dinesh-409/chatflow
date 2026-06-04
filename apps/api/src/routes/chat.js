import express from "express";
import { aiRouterStream } from "../services/routerStream.js";
import { addMessage, getMemory } from "../services/memoryService.js";
import { createSession } from "../services/sessionService.js";

const router = express.Router();

router.post("/chat-stream", async (req, res) => {
    const { message, sessionId, mode = "auto" } = req.body;

    if (!message || !sessionId) {
        return res.status(400).json({ error: "message & sessionId required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        // 🧠 ensure session exists
        await createSession(sessionId);

        // 💾 save user message
        await addMessage(sessionId, "user", message);

        // 📚 load memory
        const memory = await getMemory(sessionId);

        const context = memory.messages
            .map((m) => `${m.role}: ${m.text}`)
            .join("\n");

        // 🤖 AI stream
        const stream = await aiRouterStream({
            message: `${context}\nuser: ${message}`,
            mode,
            sessionId,
        });

        let fullResponse = "";
        let aborted = false;

        req.on("close", () => { aborted = true; });

        for await (const chunk of stream) {
            if (aborted) break;
            const text = chunk.toString();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        if (!aborted) {
            // 💾 save AI response
            await addMessage(sessionId, "ai", fullResponse);
            res.write("data: [DONE]\n\n");
        }
        res.end();

    } catch (err) {
        console.error(err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

export default router;