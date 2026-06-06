/**
 * intentDetector.js
 * ---------------------------------------------------------
 * ChatFlow — Claude × Gemini Architecture
 * Implements 10 intent buckets + Complexity Scoring
 * ---------------------------------------------------------
 */

const INTENT_MAP = [
    {
        intent: "deep_research",
        weight: 10,
        keywords: ["research", "investigate", "thesis", "literature review", "academic", "study"],
        patterns: [/\b(deep dive into|comprehensive analysis of)\b/i]
    },
    {
        intent: "coding",
        weight: 10,
        keywords: ["code", "debug", "fix", "function", "algorithm", "compile", "syntax error", "refactor", "javascript", "python", "react", "node"],
        patterns: [/```[\s\S]*```/, /TypeError|SyntaxError|ReferenceError/]
    },
    {
        intent: "analysis",
        weight: 9,
        keywords: ["compare", "evaluate", "trade-off", "assess", "architecture", "pros and cons", "breakdown", "difference between"],
        patterns: [/\b(pros|cons)\b/i, /compare\s+\w+\s+(vs?\.?|and|with)\s+\w+/i]
    },
    {
        intent: "long_form_writing",
        weight: 9,
        keywords: ["write an essay", "draft", "article", "report", "whitepaper", "documentation", "blog post"],
        patterns: [/write\s+(a\s+)?(long|detailed)\s+(article|essay|report)/i]
    },
    {
        intent: "news_realtime",
        weight: 9,
        keywords: ["latest", "breaking", "today", "live update", "current events", "trending", "this week", "headline"],
        patterns: [/\b(latest|breaking|live)\s+(news|update|report)/i]
    },
    {
        intent: "factual",
        weight: 8,
        keywords: ["who is", "when did", "price", "weather", "what is the status", "as of", "now", "current"],
        patterns: [/\b(in \d{4}|as of|right now)\b/i]
    },
    {
        intent: "summarize",
        weight: 8,
        keywords: ["summarize", "tldr", "brief", "condense", "key points", "shorten", "overview", "abstract"],
        patterns: [/\btl;?dr\b/i, /in\s+(a\s+)?few\s+words/i]
    },
    {
        intent: "creative",
        weight: 8,
        keywords: ["write a poem", "write a story", "write a song", "fiction", "imagine", "compose", "narrative", "lyrics"],
        patterns: [/write\s+(a|me\s+a|an)\s+(poem|story|song|tale|narrative)/i]
    },
    {
        intent: "explain",
        weight: 7,
        keywords: ["what is", "how does", "define", "teach me", "step by step", "tutorial", "guide", "explain"],
        patterns: [/^(what|why|how|when|where|who)\s+/i]
    },
    {
        intent: "casual",
        weight: 5,
        keywords: ["hi", "hello", "thanks", "lol", "how are you", "good morning", "jokes", "hey", "yo"],
        patterns: [/^(hi|hello|hey|yo|sup)\b/i]
    }
];

function calculateComplexity(query) {
    let score = 0;
    
    if (query.length > 500) score += 3;
    else if (query.length > 200) score += 1;
    
    if (/```[\s\S]*```/.test(query) || /`[^`]+`/.test(query)) score += 3;
    
    if (/\b(and also|first.*second.*third|\d\.\s)\b/i.test(query)) score += 2;
    if (/\b(then|after that|consequently)\b/i.test(query)) score += 2;
    if (/\[Attached Files:.*?\]/i.test(query)) score += 2; // Rough file proxy

    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    return "low";
}

export function detectIntent(query) {
    if (!query || typeof query !== "string") {
        return _build("casual", 20, "low", query);
    }

    const text = query.toLowerCase();
    const scores = {};

    for (const def of INTENT_MAP) {
        let score = 0;
        for (const kw of def.keywords) {
            if (text.includes(kw)) score += def.weight;
        }
        for (const pattern of def.patterns) {
            if (pattern.test(query)) score += def.weight * 1.5;
        }
        if (score > 0) scores[def.intent] = (scores[def.intent] || 0) + score;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return _build("casual", 30, calculateComplexity(query), query);

    const [winnerIntent, winnerScore] = sorted[0];
    const maxPossible = Math.max(...INTENT_MAP.map(d => d.weight)) * 10;
    const confidence = Math.min(100, Math.round((winnerScore / maxPossible) * 100));
    
    const complexity = calculateComplexity(query);

    return _build(winnerIntent, confidence, complexity, query);
}

function _build(intent, confidence, complexity, query = "") {
    return {
        intent,
        confidence,
        complexity,
        isLong: query.length > 300,
        hasFile: /\[Attached Files:.*?\]/i.test(query),
        isMultilingual: /[\u0B80-\u0BFF\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF]/.test(query),
        needsSearch: intent === "news_realtime" || intent === "factual",
    };
}
