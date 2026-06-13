/**
 * routerStream.js — Phase 3 Fix
    */

import axios from "axios";

/* =========================================================
   MODEL CALLERS
========================================================= */

async function callGroq(message) {
    const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: message }],
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            timeout: 20000,
        }
    );

    return res.data.choices[0].message.content;
}

async function callGemini(message) {
    try {
        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        console.log("=================================");
        console.log("GEMINI DEBUG");
        console.log("=================================");
        console.log("KEY EXISTS:", !!process.env.GEMINI_API_KEY);

        console.log(
            "KEY PREFIX:",
            process.env.GEMINI_API_KEY
                ? process.env.GEMINI_API_KEY.substring(0, 10)
                : "NO_KEY"
        );

        console.log(
            "ENDPOINT:",
            url.split("?")[0]
        );

        const res = await axios.post(
            url,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: message
                            }
                        ]
                    }
                ]
            },
            {
                timeout: 20000,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        return (
            res.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            ""
        );

    } catch (err) {

        console.error("=================================");
        console.error("GEMINI FULL ERROR");
        console.error("=================================");

        console.error(
            "STATUS:",
            err.response?.status
        );

        console.error(
            "DATA:",
            JSON.stringify(
                err.response?.data,
                null,
                2
            )
        );

        console.error(
            "MESSAGE:",
            err.message
        );

        console.error("=================================");

        throw err;
    }
}

async function callOpenRouter(message) {
    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: message }],
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
            },
            timeout: 25000,
        }
    );

    return res.data.choices[0].message.content;
}

/* =========================================================
   FAILOVER LOGIC
========================================================= */

const FALLBACK_MAP = {
    gemini: "openrouter",
    openrouter: "gemini",
    groq: "gemini",
};

async function callModel(model, message) {
    if (model === "gemini") return callGemini(message);
    if (model === "groq") return callGroq(message);
    if (model === "openrouter") return callOpenRouter(message);

    return callGemini(message);
}

/* =========================================================
   REFLECTION LAYER
========================================================= */

async function applyReflection(originalMessage, draftResponse, model) {
    const reflectionPrompt = `
You are an expert AI Quality Assurance Auditor.

USER QUERY:
${originalMessage}

DRAFT RESPONSE:
${draftResponse}

Return strict JSON only.
`;

    console.log(`[REFLECTION] Running quality score on ${model}...`);

    try {
        const rawRes = await callModel(model, reflectionPrompt);

        const cleanJson = rawRes
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const parsed = JSON.parse(cleanJson);

        if (parsed.needsRewrite && parsed.fixedResponse) {
            return parsed.fixedResponse;
        }

        return draftResponse;

    } catch (err) {
        console.error(
            `[REFLECTION] Scoring failed or JSON parse error. ${err.message}`
        );

        return draftResponse;
    }
}

/* =========================================================
   PUBLIC
========================================================= */

export async function aiRouterStream({
    message,
    mode = "gemini",
    complexity = "low",
}) {
    const primary =
        (mode === "search" || mode === "auto")
            ? "gemini"
            : mode;

    const fallback =
        FALLBACK_MAP[primary] || "gemini";

    const attempts = [
        { model: primary, stage: "primary" },
        { model: primary, stage: "retry" },
        { model: fallback, stage: "fallback" },
    ];

    let reply = "";
    let success = false;
    let successfulModel = primary;

    for (const attempt of attempts) {
        try {
            console.log(
                `[STREAM] Calling ${attempt.model} (${attempt.stage})`
            );

            reply = await callModel(
                attempt.model,
                message
            );

            success = true;
            successfulModel = attempt.model;

            break;

        } catch (err) {
            console.error(
                `[FAILOVER] ${attempt.model} | ${attempt.stage} | ${err.message}`
            );
        }
    }

    if (!success) {
        console.error(
            "[FAILOVER] ALL models failed — safe mode"
        );

        reply =
            "I'm having trouble reaching my AI providers right now. Please try again in a moment.";

        return _streamText(reply);
    }

    if (complexity === "high") {
        reply = await applyReflection(
            message,
            reply,
            successfulModel
        );
    }

    return _streamText(reply);
}

async function* _streamText(text) {
    for (const char of text) {
        yield char;
        await new Promise((r) => setTimeout(r, 5));
    }
}