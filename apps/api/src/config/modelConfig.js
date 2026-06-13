/**
 * modelConfig.js
 * ---------------------------------------------------------
 * Single source of truth for all AI model identifiers.
 *
 * When Google deprecates a model, update ONLY this file.
 * Every service imports from here — no more hunting through
 * 4+ files to swap a model string.
 * ---------------------------------------------------------
 */

// ── Gemini ──────────────────────────────────────────────
export const GEMINI_MODEL        = "gemini-2.5-flash";
export const GEMINI_DISPLAY_NAME = "Gemini 2.5 Flash";
export const GEMINI_API_VERSION  = "v1beta";

// ── Groq ────────────────────────────────────────────────
export const GROQ_MODEL          = "llama-3.1-8b-instant";

// ── OpenRouter ──────────────────────────────────────────
export const OPENROUTER_MODEL    = "openai/gpt-4o-mini";

// ── Helpers ─────────────────────────────────────────────

/**
 * Build the full Gemini REST URL for a given action.
 *
 * @param {string} action — "generateContent" | "streamGenerateContent"
 * @returns {string} URL **without** the ?key= query param
 */
export const geminiBaseUrl = (action = "generateContent") =>
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:${action}`;
