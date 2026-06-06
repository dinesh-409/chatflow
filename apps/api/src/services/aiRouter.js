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
    "claude-sonnet": {
        id: "claude-sonnet",
        displayName: "Claude Sonnet",
        strengths: ["analysis", "creative", "long-form writing", "coding (medium)"],
    },
    "claude-opus": {
        id: "claude-opus",
        displayName: "Claude Opus",
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
    // 03. News / real-time
    {
        id: "news",
        condition: (ir) => ir.intent === "news_realtime",
        model: "search",
        reason: "News / real-time intent detected — Search → Gemini synthesis"
    },
    // 04. Factual lookup
    {
        id: "factual",
        condition: (ir) => ir.intent === "factual",
        model: "search",
        reason: "Factual lookup intent detected — Search → Gemini synthesis"
    },
    // 05. Deep research + high complexity
    {
        id: "deep_research-high",
        condition: (ir) => ir.intent === "deep_research" && ir.complexity === "high",
        model: "claude-opus",
        reason: "Deep research + high complexity — Claude Opus"
    },
    // 06. Deep research + medium/low complexity
    {
        id: "deep_research-med_low",
        condition: (ir) => ir.intent === "deep_research" && ir.complexity !== "high",
        model: "claude-sonnet",
        reason: "Deep research + medium/low complexity — Claude Sonnet"
    },
    // 07. Coding — complex
    {
        id: "coding-high",
        condition: (ir) => ir.intent === "coding" && ir.complexity === "high",
        model: "claude-opus",
        reason: "Coding + high complexity — Claude Opus"
    },
    // 08. Coding — simple
    {
        id: "coding-med_low",
        condition: (ir) => ir.intent === "coding" && ir.complexity !== "high",
        model: "claude-sonnet",
        reason: "Coding + medium/low complexity — Claude Sonnet"
    },
    // 09. Analysis / compare
    {
        id: "analysis",
        condition: (ir) => ir.intent === "analysis",
        model: "claude-sonnet",
        reason: "Analysis / compare — Claude Sonnet"
    },
    // 10. Long-form writing
    {
        id: "long_form_writing",
        condition: (ir) => ir.intent === "long_form_writing",
        model: "claude-sonnet",
        reason: "Long-form writing — Claude Sonnet"
    },
    // 11. Creative writing
    {
        id: "creative",
        condition: (ir) => ir.intent === "creative",
        model: "claude-sonnet",
        reason: "Creative writing — Claude Sonnet"
    },
    // 12. Summarisation
    {
        id: "summarize",
        condition: (ir) => ir.intent === "summarize",
        model: "gemini",
        reason: "Summarisation — Gemini for speed priority"
    },
    // 13. Explanation / how-to
    {
        id: "explain",
        condition: (ir) => ir.intent === "explain",
        model: "gemini",
        reason: "Explanation / how-to — Gemini"
    },
    // 14. Casual / greeting
    {
        id: "casual",
        condition: (ir) => ir.intent === "casual",
        model: "gemini",
        reason: "Casual / greeting — Gemini"
    },
    // 15. Any + very long file
    {
        id: "long_file",
        condition: (ir) => ir.hasFile && ir.complexity === "high",
        model: "claude-opus",
        reason: "Very long file context — Claude Opus"
    }
];

/* =========================================================
   FAILOVER CHAIN
========================================================= */
const FAILOVER_CHAIN = {
    "gemini": ["claude-sonnet"],
    "claude-sonnet": ["gemini"],
    "claude-opus": ["claude-sonnet", "gemini"],
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
        confidence: intentResult.confidence,
        complexity: intentResult.complexity,
        failover: FAILOVER_CHAIN[m.id] || ["gemini"],
        needsSearch: intentResult.needsSearch || m.id === "search",
    };
}
