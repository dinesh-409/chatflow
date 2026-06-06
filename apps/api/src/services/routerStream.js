/**
 * routerStream.js — Phase 3 Fix
 * ---------------------------------------------------------
 * BUG FIXED: Previously called chooseModel() internally,
 * overriding the RouterDecision already made by selectModel()
 * in chatController. This caused every request to re-run
 * routing independently and often land on openrouter.
 *
 * FIX: aiRouterStream now accepts an explicit `mode` that
 * chatController passes AFTER running selectModel(). The
 * internal fallback only fires if no mode is given.
 *
 * Failover chain: primary → retry same → fallback model
 * ---------------------------------------------------------
 */

import axios from "axios";

/* =========================================================
   MODEL CALLERS
========================================================= */

async function callGroq(message) {
    const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model    : "llama-3.1-8b-instant",
            messages : [{ role: "user", content: message }],
        },
        {
            headers : {
                Authorization  : `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type" : "application/json",
            },
            timeout: 20000,
        }
    );
    return res.data.choices[0].message.content;
}

async function callGemini(message) {
    const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: message }] }] },
        { timeout: 20000 }
    );
    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenRouter(message) {
    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model    : "openai/gpt-4o-mini",
            messages : [{ role: "user", content: message }],
        },
        {
            headers : {
                Authorization  : `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type" : "application/json",
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
    gemini     : "openrouter",
    openrouter : "gemini",
    groq       : "gemini",
};

async function callModel(model, message) {
    if (model === "gemini")     return callGemini(message);
    if (model === "groq")       return callGroq(message);
    if (model === "openrouter") return callOpenRouter(message);
    // Unknown model — default to gemini
    return callGemini(message);
}

/* =========================================================
   PUBLIC — aiRouterStream
========================================================= */

/**
 * aiRouterStream({ message, mode }) → AsyncGenerator<string>
 *
 * @param {string} message — the full prompt to send
 * @param {string} mode    — model id from selectModel() decision.
 *                           Do NOT call chooseModel() here; the
 *                           decision is made upstream in chatController.
 */
export async function aiRouterStream({ message, mode = "gemini" }) {
    // Normalise: "search" and "auto" both resolve to gemini
    // (search data is already injected into the prompt by this point)
    const primary = (mode === "search" || mode === "auto") ? "gemini" : mode;
    const fallback = FALLBACK_MAP[primary] || "gemini";

    const attempts = [
        { model: primary,  stage: "primary"    },
        { model: primary,  stage: "retry"      },
        { model: fallback, stage: "fallback"   },
    ];

    let reply   = "";
    let success = false;

    for (const attempt of attempts) {
        try {
            console.log(`[STREAM] Calling ${attempt.model} (${attempt.stage})`);
            reply   = await callModel(attempt.model, message);
            success = true;
            break;
        } catch (err) {
            console.error(`[FAILOVER] ${attempt.model} | ${attempt.stage} | ${err.message}`);
        }
    }

    if (!success) {
        console.error("[FAILOVER] ALL models failed — safe mode");
        reply = "I'm having trouble reaching my AI providers right now. Please try again in a moment.";
    }

    // Yield response as async stream (character-by-character for SSE)
    return _streamText(reply);
}

async function* _streamText(text) {
    for (const char of text) {
        yield char;
        await new Promise(r => setTimeout(r, 5));
    }
}