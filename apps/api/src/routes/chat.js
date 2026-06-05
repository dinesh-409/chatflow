import express from "express";
import { aiRouterStream } from "../services/routerStream.js";
import { chooseModel } from "../services/modelRouter.js";
import { addMessage, getMemory, getGlobalMemory } from "../services/memoryService.js";
import { createSession } from "../services/sessionService.js";
import { parseFileLocal } from "../services/fileParser.js";

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
        let modifiedMessage = message;
        
        // 📁 FILE PARSING PIPELINE
        const fileRegex = /\[Attached Files:\s*(.+?)\]/g;
        let match;
        while ((match = fileRegex.exec(message)) !== null) {
            const urls = match[1].split(", ");
            for (const url of urls) {
                if (url.includes("/uploads/")) {
                    console.log(`[FILE PIPELINE] Parsing locally: ${url}`);
                    const fileText = await parseFileLocal(url);
                    if (fileText) {
                        const chunkedText = fileText.substring(0, 15000); // Safe chunk limit
                        modifiedMessage += `\n\n--- EXTRACTED FILE CONTENT ---\n${chunkedText}\n--- END FILE CONTENT ---\n`;
                    }
                }
            }
            // Strip the raw URLs so we don't send localhost links to the provider
            modifiedMessage = modifiedMessage.replace(match[0], "[Files Processed Locally]");
        }

        const session = await createSession(sessionId);
        
        if (session && session.title === "New Chat") {
            (async () => {
                try {
                    const titlePrompt = `Summarize this text in 2 or 3 words max for a chat title. Do not use quotes or periods. Text: "${modifiedMessage}"`;
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
You are ChatFlow AI, an Intent-Aware Multi-Model Cognitive AI System.
All responses must be generated based on detected user intent. The system must interpret meaning first, then decide structure, language style, and model routing. Instruction-following is strict and non-negotiable.
All responses must be presented in structured, section-based format optimized for readability, EXCEPT for simple direct questions.
For complex answers, MUST be formatted into clear visual sections using headings, bullet points, and spacing. 
For simple or casual questions (e.g., "What is my name?", "Hi", "How are you?"), BYPASS structural formatting. Provide a natural, conversational 1-2 sentence response (e.g., "Your name is Dinesh.") but STRICTLY avoid headings, bullet points, or unnecessary paragraphs.

SYSTEM DIRECTIVE: All requests involving files must be preprocessed into structured text before sending to any AI model. If AI provider fails, automatically fallback to next model and retry once before showing error. AI provider errors must never be exposed directly to users. System must always attempt failover routing, prompt simplification, or safe mode summarization before showing failure.
DEPLOYMENT SAFETY RULE: All file processing libraries (pdf-parse, docx parser, xlsx parser) must be explicitly listed in the backend package.json and installed before deployment. No file processing module should be imported unless it is verified in production dependencies and installed during build phase.
CONVERSATIONAL PRECISION RULE: Answer ONLY what the user explicitly asks. Do NOT append unnecessary details, do NOT summarize past conversations, and do NOT talk about previous topics unless the user directly requests it. If the user asks a simple question (like "What is my name?" or "Hi"), provide a direct, concise answer without any conversational padding, transition, or references to past context.

Global User Context (From past sessions):
${globalContext}

Previous Conversation (Current Session):
${context}

User:
${modifiedMessage}

Assistant:
`;

        const selectedMode = chooseModel(message, mode);

        const stream = await aiRouterStream({
            message: prompt,
            mode: selectedMode,
        });
        
        let modelDisplayName = "Gemini 3.1 Pro";
        if (selectedMode === "groq") modelDisplayName = "Groq Llama 3.1";
        if (selectedMode === "openrouter") modelDisplayName = "OpenRouter GPT-4o";

        res.write(`data: ${JSON.stringify({ type: "meta", model: modelDisplayName })}\n\n`);

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
            message,
            selectedMode
        );

        if (fullResponse) {
            await addMessage(
                sessionId,
                "ai",
                fullResponse,
                selectedMode
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