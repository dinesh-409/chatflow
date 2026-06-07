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
   REFLECTION LAYER & QUALITY SCORING
========================================================= */
async function applyReflection(originalMessage, draftResponse, model) {
    const reflectionPrompt = `
You are an expert AI Quality Assurance Auditor.
Review the following DRAFT RESPONSE to the USER QUERY.

USER QUERY:
${originalMessage}

DRAFT RESPONSE:
${draftResponse}

Evaluate the draft on 4 criteria (out of 10):
1. Completeness: Does it fully answer the prompt without leaving out critical requested information?
2. Relevance: Is it strictly focused on the user's core intent?
3. Clarity & Tone: Is the formatting excellent? PENALIZE generic AI phrasing (e.g., "As an AI...", "It's important to remember...", "In conclusion"). Be direct and human-like.
4. Factuality: Are there zero hallucinations?

Then, calculate the "averageScore".
If the averageScore is >= 8.5, set "needsRewrite" to false and leave "fixedResponse" empty.
If the averageScore is < 8.5, set "needsRewrite" to true and provide the fully improved response in "fixedResponse".

Respond STRICTLY in JSON format with no markdown wrappers or additional text:
{
  "completeness": number,
  "relevance": number,
  "clarity": number,
  "factuality": number,
  "averageScore": number,
  "needsRewrite": boolean,
  "fixedResponse": "string"
}
`;
    console.log(`[REFLECTION] Running quality score on ${model}...`);
    try {
        const rawRes = await callModel(model, reflectionPrompt);
        const cleanJson = rawRes.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        console.log(`[REFLECTION] Quality Score: ${parsed.averageScore}/10. Needs Rewrite: ${parsed.needsRewrite}`);
        
        if (parsed.needsRewrite && parsed.fixedResponse) {
            return parsed.fixedResponse;
        }
        return draftResponse;
    } catch (err) {
        console.error(`[REFLECTION] Scoring failed or JSON parse error. ${err.message}`);
        return draftResponse;
    }
}

/* =========================================================
   PUBLIC — aiRouterStream
========================================================= */

/**
 * aiRouterStream({ message, mode, complexity }) → AsyncGenerator<string>
 *
 * @param {string} message — the full prompt to send
 * @param {string} mode    — model id from selectModel() decision.
 *                           Do NOT call chooseModel() here; the
 *                           decision is made upstream in chatController.
 * @param {string} complexity — "low" | "medium" | "high"
 */
export async function aiRouterStream({ message, mode = "gemini", complexity = "low" }) {
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
    let successfulModel = primary;

    for (const attempt of attempts) {
        try {
            console.log(`[STREAM] Calling ${attempt.model} (${attempt.stage})`);
            reply   = await callModel(attempt.model, message);
            success = true;
            successfulModel = attempt.model;
            break;
        } catch (err) {
            console.error(`[FAILOVER] ${attempt.model} | ${attempt.stage} | ${err.message}`);
        }
    }

    if (!success) {
        console.error("[FAILOVER] ALL models failed — safe mode");
        reply = "I'm having trouble reaching my AI providers right now. Please try again in a moment.";
        return _streamText(reply);
    }

    // --- REFLECTION LAYER ---
    if (complexity === "high") {
        reply = await applyReflection(message, reply, successfulModel);
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