/**
 * modelRouter.js
 * ─────────────────────────────────────────────────────────
 * Backward-compatible delegation layer.
 *
 * All callers that import { chooseModel } or
 * { shouldUseWebSearch } from this file continue to work.
 * Internally, chooseModel now delegates to the AI Router brain
 * (aiRouter.js → intentDetector.js) for richer decisions.
 * ─────────────────────────────────────────────────────────
 */

import { selectModelId } from "./aiRouter.js";

/**
 * chooseModel(message, mode?)
 *
 * Drop-in replacement for old keyword-based picker.
 * Returns a model id string: "gemini" | "openrouter" | "groq"
 *
 * @param {string} message — raw user query
 * @param {string} mode    — "auto" | explicit model id
 * @returns {string}
 */
export const chooseModel = (message, mode = "auto") => {
    // Let explicit modes pass through untouched
    if (mode && mode !== "auto") return mode;
    return selectModelId(message, mode);
};

/**
 * shouldUseWebSearch(message) → boolean
 *
 * Kept for direct callers in chatController (file/search pipeline).
 * Now powered by intentDetector under the hood.
 */
export const shouldUseWebSearch = (message) => {
    const text = message.toLowerCase();
    const factualKeywords = [
        "today", "now", "latest", "news", "current", "price", "stock",
        "president", "election", "result", "match", "score", "weather",
        "update", "recent", "this week", "this month", "trending",
        "who is the", "what is the status", "live", "real-time", "happened"
    ];
    return factualKeywords.some(kw => text.includes(kw));
};