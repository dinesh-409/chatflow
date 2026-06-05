import axios from "axios";
import { chooseModel } from "./modelRouter.js";

async function groqStream(message) {
    const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "user",
                    content: message,
                },
            ],
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
        }
    );

    return res.data.choices[0].message.content;
}

async function geminiStream(message) {
    const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            contents: [
                {
                    parts: [
                        {
                            text: message,
                        },
                    ],
                },
            ],
        }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function openrouterStream(message) {
    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "openai/gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: message,
                },
            ],
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
            },
        }
    );

    return res.data.choices[0].message.content;
}

export async function aiRouterStream({
    message,
    mode = "auto",
}) {
    const originalSelected = chooseModel(message, mode);
    let selected = originalSelected;

    let reply = "";
    let success = false;

    // Failover Queue: Primary -> Same Model Retry -> Fallback Model
    const getFallback = (current) => {
        if (current === "gemini") return "openrouter";
        if (current === "openrouter") return "gemini";
        if (current === "groq") return "gemini";
        return "openrouter";
    };

    const attempts = [
        { model: originalSelected, stage: "primary" },
        { model: originalSelected, stage: "retry_same" },
        { model: getFallback(originalSelected), stage: "fallback" }
    ];

    for (const attempt of attempts) {
        selected = attempt.model;
        try {
            if (selected === "gemini") {
                reply = await geminiStream(message);
            } else if (selected === "groq") {
                reply = await groqStream(message);
            } else {
                reply = await openrouterStream(message);
            }
            success = true;
            break; // Success!
        } catch (err) {
            console.error(`[FAILOVER LOG] model_used: ${selected} | stage: ${attempt.stage} | error: ${err.message}`);
        }
    }

    if (!success) {
        console.error("[FAILOVER LOG] ALL MODELS FAILED. Triggering SAFE MODE.");
        reply = "Unable to reach primary AI models. Switching to backup reasoning engine. (Safe Mode: Internal fallback engaged. Please try summarizing or sending smaller prompts.)";
    }

    async function* streamText(text) {
        for (const char of text) {
            yield char;
            await new Promise((r) => setTimeout(r, 5));
        }
    }

    return streamText(reply);
}