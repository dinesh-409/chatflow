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
    const selected = chooseModel(message, mode);

    let reply = "";

    try {
        if (selected === "gemini") {
            reply = await geminiStream(message);
        } else if (selected === "groq") {
            reply = await groqStream(message);
        } else {
            reply = await openrouterStream(message);
        }
    } catch (err) {
        console.error("AI Provider Error:", err.response?.data || err.message);

        reply =
            "Sorry, AI provider error occurred. Please try again.";
    }

    async function* streamText(text) {
        for (const char of text) {
            yield char;
            await new Promise((r) => setTimeout(r, 5));
        }
    }

    return streamText(reply);
}