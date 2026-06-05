import express from "express";
import { aiRouterStream } from "../services/routerStream.js";
import { chooseModel } from "../services/modelRouter.js";
import { addMessage, getMemory, getGlobalMemory } from "../services/memoryService.js";
import { createSession } from "../services/sessionService.js";

const router = express.Router();

router.post("/chat-stream", async (req, res) => {
    const { message, sessionId, mode = "auto" } = req.body;

    if (!message || !sessionId) {
        return res.status(400).json({
            error: "message & sessionId required",
        });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const session = await createSession(sessionId);
        
        if (session && session.title === "New Chat") {
            (async () => {
                try {
                    const titlePrompt = `Summarize this text in 2 or 3 words max for a chat title. Do not use quotes or periods. Text: "${message}"`;
                    const stream = await aiRouterStream({ message: titlePrompt, mode: "groq" });
                    let generatedTitle = "";
                    for await (const chunk of stream) generatedTitle += chunk.toString();
                    session.title = generatedTitle.replace(/["']/g, "").trim();
                    await session.save();
                } catch (e) {
                    // Fallback to first few words if AI rate-limits
                    session.title = message.split(" ").slice(0, 3).join(" ");
                    await session.save();
                }
            })();
        }

        const memory = await getMemory(sessionId);
        const globalContext = await getGlobalMemory(sessionId);

        const context = memory.messages
            .slice(-10)
            .map((m) => `${m.role}: ${m.text}`)
            .join("\n");

        const prompt = `
You are ChatFlow AI.

Global User Context (From past sessions):
${globalContext}

Previous Conversation (Current Session):
${context}

User:
${message}

Assistant:
`;

        const selectedMode = chooseModel(message, mode);

        const stream = await aiRouterStream({
            message: prompt,
            mode: selectedMode,
        });

        let fullResponse = "";
        let aborted = false;

        req.on("close", () => {
            aborted = true;
        });

        for await (const chunk of stream) {
            if (aborted) break;

            const text = chunk.toString();

            fullResponse += text;

            // IMPORTANT FIX
            res.write(
                `data: ${JSON.stringify({ text })}\n\n`
            );
        }

        await addMessage(
            sessionId,
            "user",
            message
        );

        if (fullResponse) {
            await addMessage(
                sessionId,
                "ai",
                fullResponse
            );
        }

        if (!aborted) {
            res.write("data: [DONE]\n\n");
        }

        res.end();
    } catch (err) {
        console.error(err);

        res.write(
            `data: ${JSON.stringify({
                text: `Error: ${err.message}`,
            })}\n\n`
        );

        res.end();
    }
});

export default router;