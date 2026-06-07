/**
 * aiRouter.js
 * ---------------------------------------------------------
 * ChatFlow — Claude × Gemini Architecture
 * Model Selection Rules
 * ---------------------------------------------------------
 */

import { detectIntent } from "./intentDetector.js";

/* =========================================================
   MODEL REGISTRY
========================================================= */
export const MODEL_REGISTRY = {
    "gemini": {
        id: "gemini",
        displayName: "Gemini 3.1 Pro",
        strengths: ["casual", "explain", "summarize", "factual", "multilingual", "news synthesis"],
    },
    "groq": {
        id: "groq",
        displayName: "Groq Llama 3.1",
        strengths: ["analysis", "creative", "long-form writing", "coding (simple)"],
    },
    "openrouter": {
        id: "openrouter",
        displayName: "OpenRouter GPT-4o",
        strengths: ["deep research", "complex code", "large document analysis"],
    },
    "search": {
        id: "search",
        displayName: "Live Search + Gemini",
        strengths: ["factual", "news", "real-time"],
    },
};

/* =========================================================
   ROUTING RULES TABLE
========================================================= */
const ROUTING_RULES = [
    // 01. User manual override
    {
        id: "explicit-mode",
        condition: (_, __, mode) => mode && mode !== "auto",
        model: (_, __, mode) => mode,
        reason: "User manual override"
    },
    // 02. Non-Latin script
    {
        id: "multilingual",
        condition: (ir) => ir.isMultilingual,
        model: "gemini",
        reason: "Non-Latin script detected — Gemini handles most languages"
    },
    // 03. Follow-up + High Complexity
    {
        id: "followup-high",
        condition: (ir) => ir.isFollowUp && ir.complexity === "high",
        model: "openrouter",
        reason: "Complex follow-up — needs deep reasoning over context"
    },
    // 04. Follow-up (Normal)
    {
        id: "followup-normal",
        condition: (ir) => ir.isFollowUp,
        model: "gemini",
        reason: "Follow-up question — Gemini excels at huge context windows"
    },
    // 05. Research
    {
        id: "research",
        condition: (ir) => ir.intent === "research",
        model: "search",
        reason: "Research intent detected — Search → Gemini synthesis"
    },
    // 06. Planning + high complexity
    {
        id: "planning-high",
        condition: (ir) => ir.intent === "planning" && ir.complexity === "high",
        model: "openrouter",
        reason: "Planning + high complexity — OpenRouter GPT-4o"
    },
    // 07. Planning + medium/low complexity
    {
        id: "planning-med_low",
        condition: (ir) => ir.intent === "planning" && ir.complexity !== "high",
        model: "groq",
        reason: "Planning + medium/low complexity — Groq Llama 3.1"
    },
    // 08. Coding — complex
    {
        id: "coding-high",
        condition: (ir) => ir.intent === "coding" && ir.complexity === "high",
        model: "openrouter",
        reason: "Coding + high complexity — OpenRouter GPT-4o"
    },
    // 09. Coding — simple
    {
        id: "coding-med_low",
        condition: (ir) => ir.intent === "coding" && ir.complexity !== "high",
        model: "groq",
        reason: "Coding + medium/low complexity — Groq Llama 3.1"
    },
    // 10. Comparison
    {
        id: "comparison",
        condition: (ir) => ir.intent === "comparison",
        model: "groq",
        reason: "Comparison / Analysis — Groq Llama 3.1"
    },
    // 11. Creative writing
    {
        id: "creative",
        condition: (ir) => ir.intent === "creative",
        model: "groq",
        reason: "Creative writing — Groq Llama 3.1"
    },
    // 12. Educational / explain
    {
        id: "educational",
        condition: (ir) => ir.intent === "educational",
        model: "gemini",
        reason: "Educational / explain — Gemini"
    },
    // 13. Simple / casual
    {
        id: "simple",
        condition: (ir) => ir.intent === "simple",
        model: "gemini",
        reason: "Simple / casual — Gemini"
    },
    // 14. Any + very long file
    {
        id: "long_file",
        condition: (ir) => ir.hasFile && ir.complexity === "high",
        model: "openrouter",
        reason: "Very long file context — OpenRouter GPT-4o"
    }
];

/* =========================================================
   FAILOVER CHAIN
========================================================= */
const FAILOVER_CHAIN = {
    "gemini": ["groq", "openrouter"],
    "groq": ["gemini", "openrouter"],
    "openrouter": ["gemini", "groq"],
    "search": ["gemini"],
};

/* =========================================================
   PUBLIC API
========================================================= */

export function selectModel(query, context = {}, mode = "auto") {
    const intentResult = detectIntent(query);

    for (const rule of ROUTING_RULES) {
        if (!rule.condition(intentResult, context, mode)) continue;

        const modelId = typeof rule.model === "function"
            ? rule.model(intentResult, context, mode)
            : rule.model;

        const reason = typeof rule.reason === "function"
            ? rule.reason(intentResult, context, mode)
            : rule.reason;

        return _build(modelId, intentResult, reason);
    }

    // 16. Default
    return _build("gemini", intentResult, "Default — nothing matched");
}

export function selectModelId(query, mode = "auto") {
    const d = selectModel(query, {}, mode);
    return d.model === "search" ? "gemini" : d.model;
}

function _build(modelId, intentResult, reason) {
    const m = MODEL_REGISTRY[modelId] || MODEL_REGISTRY.gemini;
    return {
        model: m.id,
        displayName: m.displayName,
        reason,
        intent: intentResult.intent,
        responseType: intentResult.responseType,
        confidence: intentResult.confidence,
        complexity: intentResult.complexity,
        isFollowUp: intentResult.isFollowUp,
        isLiveQuery: intentResult.isLiveQuery,
        failover: FAILOVER_CHAIN[m.id] || ["gemini"],
        needsSearch: intentResult.needsSearch || m.id === "search",
    };
}
