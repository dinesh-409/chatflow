/**
 * responseModeService.js
 * ---------------------------------------------------------
 * ChatFlow — Response Mode Decision Layer
 * ---------------------------------------------------------
 */

/**
 * Decides the response mode based on the user's query and whether search was used.
 * 
 * @param {string} query - The user's input query.
 * @param {boolean} searchUsed - Whether the search layer was activated.
 * @returns {"clean_summary" | "detailed_with_sources" | "mixed_mode"}
 */
export function decideResponseMode(query, searchUsed) {
    if (!query) return "clean_summary";
    const text = query.toLowerCase();

    // 1. Detailed with Sources Mode
    const sourceKeywords = ["news", "latest", "research", "paper", "source", "prove", "reference", "citation"];
    if (sourceKeywords.some(kw => text.includes(kw))) {
        return "detailed_with_sources";
    }

    // 2. Mixed Mode
    const mixedKeywords = ["compare", "vs", "deep research", "analysis"];
    if (mixedKeywords.some(kw => text.includes(kw))) {
        return "mixed_mode";
    }

    // 3. Default (Clean Summary Mode)
    // For explanations, simple QA, summaries, concepts
    return "clean_summary";
}

/**
 * Returns strict LLM instructions tailored to the selected response mode.
 * 
 * @param {"clean_summary" | "detailed_with_sources" | "mixed_mode"} mode 
 * @returns {string}
 */
export function getModePromptInstructions(mode) {
    const universalRule = "UNIVERSAL RULE: Never inject raw search links or URLs into your main answer text. Sources are handled independently by the system UI. Do not say 'for more details refer to this link'.";

    switch (mode) {
        case "clean_summary":
            return `${universalRule}
MODE: clean_summary. EXPLAIN CONCEPTS CLEARLY. DO NOT include any links, URLs, citations, or 'for more info refer to' statements in your output. Provide a purely structural, human-like explanation.`;
        
        case "detailed_with_sources":
            return `${universalRule}
MODE: detailed_with_sources. PROVIDE DETAILED EXPLANATION. Do not inject raw links mid-sentence. You may list references at the very end of your response if strictly necessary, but prioritize readability.`;
        
        case "mixed_mode":
            return `${universalRule}
MODE: mixed_mode. Provide a clean explanation or comparison first. Do not clutter the text with raw URLs. You may add a brief optional sources section at the very end.`;
        
        default:
            return universalRule;
    }
}
