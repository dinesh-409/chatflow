import axios from "axios";
import { chooseModel } from "./modelRouter.js";

// 🔥 GEMINI
async function geminiStream(message) {
    const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            contents: [{ parts: [{ text: message }] }]
        }
    );

    return res.data.candidates[0].content.parts[0].text;
}

// ⚡ GROQ
async function groqStream(message) {
    const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama3-70b-8192",
            messages: [{ role: "user", content: message }]
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`
            }
        }
    );

    return res.data.choices[0].message.content;
}

// 🌐 OPENROUTER
async function openrouterStream(message) {
    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: message }]
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
            }
        }
    );

    return res.data.choices[0].message.content;
}

// 🚀 MAIN ROUTER
export async function aiRouterStream({ message, mode = "auto" }) {
    const selected = chooseModel(message, mode);

    let reply = "";

    if (selected === "gemini") {
        reply = await geminiStream(message);
    }

    else if (selected === "groq") {
        reply = await groqStream(message);
    }

    else {
        reply = await openrouterStream(message);
    }

    // 🔥 convert to stream-like generator
    async function* streamText(text) {
        for (const char of text) {
            await new Promise((r) => setTimeout(r, 10));
            yield char;
        }
    }

    return streamText(reply);
}