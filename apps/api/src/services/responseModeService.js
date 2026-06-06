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
MODE: clean_summary. ADAPT YOUR RESPONSE LENGTH. For simple questions, be concise and direct. For complex topics, explain clearly and elaborately using structured paragraphs and bullet points. DO NOT include any links, URLs, or citations in your output.`;
        
        case "detailed_with_sources":
            return `${universalRule}
MODE: detailed_with_sources. PROVIDE A HIGHLY DETAILED AND CATEGORIZED EXPLANATION. Synthesize multiple data points from the sources into a rich, comprehensive format. Use distinct headings, bold text, and emojis extensively. Do not inject raw links mid-sentence.`;
        
        case "mixed_mode":
            return `${universalRule}
MODE: mixed_mode. Provide an elaborate, deep, and multi-faceted analysis. Use rich Markdown formatting, distinct headings, emojis, and structured lists. Do not clutter the text with raw URLs.`;
        
        default:
            return universalRule;
    }
}
