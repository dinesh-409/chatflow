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
