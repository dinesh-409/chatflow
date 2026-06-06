/**
 * aiRouter.js — Phase 3 Fix
 * ---------------------------------------------------------
 * Root cause of "always GPT-4o" bug fixed:
 *   - "long-query" rule was matching BEFORE intent-specific rules
 *     for any message over 300 chars, routing everything to openrouter.
 *   - Rule is now moved to lowest priority (below all intent rules).
 *
 * New intents wired:
 *   - creative  → Gemini (Phase 4: Claude when available)
 *   - news      → search + Gemini
 *   - factual   → search + Gemini (was routing to openrouter)
 *   - summarize → Groq  (unchanged)
 *
 * selectModel() is still the single source of truth.
 * selectModelId() is the backward-compat string-only shim.
 * ---------------------------------------------------------
 */

import { detectIntent } from "./intentDetector.js";

/* =========================================================
   MODEL REGISTRY
   Single source of truth. Add Claude here when API key added.
========================================================= */
export const MODEL_REGISTRY = {
    gemini: {
        id          : "gemini",
        displayName : "Gemini 3.1 Pro",
        strengths   : ["factual", "multilingual", "casual", "general", "summarize", "creative", "news"],
        available   : true,
    },
    openrouter: {
        id          : "openrouter",
        displayName : "OpenRouter GPT-4o",
        strengths   : ["coding", "analysis", "reasoning", "structured", "logic"],
        available   : true,
    },
    groq: {
        id          : "groq",
        displayName : "Groq Llama 3.1",
        strengths   : ["summarize", "speed", "casual", "short"],
        available   : true,
    },
    // Phase 4 — uncomment + add CLAUDE_API_KEY to .env
    // claude: {
    //     id          : "claude",
    //     displayName : "Anthropic Claude",
    //     strengths   : ["creative", "analysis", "long-form", "research"],
    //     available   : false,
    // },
    search: {
        id          : "search",
        displayName : "Live Search + Gemini",
        strengths   : ["factual", "news", "real-time"],
        available   : true,
    },
};

/* =========================================================
   ROUTING RULES TABLE
   Priority order is critical — first match wins.
   BUG FIX: moved "long-query" catch-all to LAST position.
========================================================= */
const ROUTING_RULES = [

    // 1. Explicit user override — always first
    {
        id        : "explicit-mode",
        condition : (_, __, mode) => mode && mode !== "auto",
        model     : (_, __, mode) => mode,
        reason    : (_, __, mode) => `User selected mode: ${mode}`,
    },

    // 2. Non-Latin / multilingual → Gemini
    {
        id        : "multilingual",
        condition : (ir) => ir.isMultilingual,
        model     : "gemini",
        reason    : "Non-Latin / regional language — Gemini multilingual",
    },

    // 3. News / real-time → search layer + Gemini for synthesis
    {
        id      : "news",
        intents : ["news"],
        model   : "search",
        reason  : "News / live update query — triggering search layer then Gemini synthesis",
    },

    // 4. Factual / real-time → search layer + Gemini
    {
        id      : "factual",
        intents : ["factual"],
        model   : "search",
        reason  : "Factual / real-time query — search layer activated, Gemini synthesises answer",
    },

    // 5. Coding / debugging → GPT-4o
    {
        id      : "coding",
        intents : ["coding"],
        model   : "openrouter",
        reason  : "Coding / debugging — GPT-4o selected for structured code generation",
    },

    // 6. Deep analysis / compare → GPT-4o
    {
        id      : "analysis",
        intents : ["analysis"],
        model   : "openrouter",
        reason  : "Deep analysis / architecture — GPT-4o for structured reasoning",
    },

    // 7. Creative writing → Gemini (Claude when available in Phase 4)
    {
        id      : "creative",
        intents : ["creative"],
        model   : "gemini",
        reason  : "Creative writing — Gemini selected (Claude available Phase 4)",
    },

    // 8. Summarise → Groq (fastest)
    {
        id      : "summarize",
        intents : ["summarize"],
        model   : "groq",
        reason  : "Summarisation — Groq Llama selected for speed",
    },

    // 9. Explanation / how-to → Gemini (conversational clarity)
    {
        id      : "explain",
        intents : ["explain"],
        model   : "gemini",
        reason  : "Explanation request — Gemini for conversational clarity",
    },

    // 10. Casual / greeting → Gemini
    {
        id      : "casual",
        intents : ["casual"],
        model   : "gemini",
        reason  : "Casual / greeting — Gemini for natural tone",
    },

    // 11. Long query LAST — only fires when no intent matched above
    //     ORIGINAL BUG: this was rule #5, above explain/summarize/casual
    {
        id        : "long-query-fallback",
        condition : (ir) => ir.isLong,
        model     : "openrouter",
        reason    : "Long unclassified query — GPT-4o for structured multi-part answer",
    },
];

/* =========================================================
   FAILOVER CHAIN
========================================================= */
const FAILOVER_CHAIN = {
    gemini     : ["openrouter", "groq"],
    openrouter : ["gemini", "groq"],
    groq       : ["gemini", "openrouter"],
    search     : ["gemini", "openrouter"],
};

/* =========================================================
   PUBLIC API
========================================================= */

/**
 * selectModel(query, context?, mode?) → RouterDecision
 *
 * @param {string} query
 * @param {Object} context — session context (Phase 3+ memory)
 * @param {string} mode    — "auto" | "gemini" | "openrouter" | "groq"
 * @returns {RouterDecision}
 */
export function selectModel(query, context = {}, mode = "auto") {
    const intentResult = detectIntent(query);

    for (const rule of ROUTING_RULES) {
        const matchesIntent   = !rule.intents || rule.intents.includes(intentResult.intent);
        const passesCondition = !rule.condition || rule.condition(intentResult, context, mode);

        if (!matchesIntent || !passesCondition) continue;

        const modelId = typeof rule.model === "function"
            ? rule.model(intentResult, context, mode)
            : rule.model;

        const reason = typeof rule.reason === "function"
            ? rule.reason(intentResult, context, mode)
            : rule.reason;

        if (!MODEL_REGISTRY[modelId]) {
            console.warn(`[AI ROUTER] Unknown model "${modelId}" in rule "${rule.id}" — fallback gemini`);
            return _build("gemini", intentResult, `Fallback: unknown model in rule ${rule.id}`);
        }

        return _build(modelId, intentResult, reason);
    }

    // Default
    return _build("gemini", intentResult, "Default — no intent rule matched");
}

/**
 * selectModelId(query, mode?) → string
 * Backward-compatible shim returning just the model id.
 * Maps "search" → "gemini" (search data already injected in controller).
 */
export function selectModelId(query, mode = "auto") {
    const d = selectModel(query, {}, mode);
    return d.model === "search" ? "gemini" : d.model;
}

/* =========================================================
   PRIVATE
========================================================= */
function _build(modelId, intentResult, reason) {
    const m = MODEL_REGISTRY[modelId] || MODEL_REGISTRY.gemini;
    return {
        model       : m.id,
        displayName : m.displayName,
        reason,
        intent      : intentResult.intent,
        confidence  : intentResult.confidence,
        signals     : intentResult.signals,
        failover    : FAILOVER_CHAIN[m.id] || ["gemini"],
        needsSearch : m.id === "search",
    };
}
