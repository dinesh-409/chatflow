/**
 * intentDetector.js
 * ---------------------------------------------------------
 * ChatFlow — Claude × Gemini Architecture
 * Implements the 7 core dynamic prompt categories
 * Enhanced for highly robust follow-up and intent capture.
 * ---------------------------------------------------------
 */

const INTENT_MAP = [
    {
        intent: "research",
        weight: 10,
        keywords: [
            "research", "investigate", "thesis", "literature review", "academic", "study",
            "in-depth", "deep dive", "comprehensive review", "explore thoroughly",
            "historical context", "empirical", "peer-reviewed", "find papers", "news",
            "latest", "today", "live update", "current events", "trending"
        ],
        patterns: [
            /\b(deep dive into|comprehensive analysis of|detailed report on|thorough investigation of)\b/i,
            /\b(latest|breaking|live|recent)\s+(news|update|report|events)\b/i
        ]
    },
    {
        intent: "coding",
        weight: 10,
        keywords: [
            "code", "debug", "fix", "function", "algorithm", "compile", "syntax error", 
            "refactor", "javascript", "python", "react", "node", "typescript", "golang",
            "rust", "java", "css", "html", "database query", "sql", "api", "endpoint"
        ],
        patterns: [/```[\s\S]*```/, /TypeError|SyntaxError|ReferenceError/, /how to (write|build) (a|an) (app|script|function|api|component)/i]
    },
    {
        intent: "comparison",
        weight: 9,
        keywords: [
            "compare", "evaluate", "trade-off", "assess", "architecture", "pros and cons", 
            "breakdown", "difference between", "vs", "versus", "which is better",
            "advantages", "disadvantages", "critique"
        ],
        patterns: [/\b(pros|cons)\b/i, /compare\s+\w+\s+(vs?\.?|and|with)\s+\w+/i, /(what is the difference between|how do they compare)/i]
    },
    {
        intent: "planning",
        weight: 9,
        keywords: [
            "plan", "roadmap", "schedule", "strategy", "timeline", "phases", "steps to",
            "blueprint", "milestones", "project plan", "organize", "outline"
        ],
        patterns: [/\b(how to plan|create a roadmap|outline a strategy|step-by-step plan)\b/i]
    },
    {
        intent: "creative",
        weight: 8,
        keywords: [
            "write an essay", "draft", "article", "blog post", "cover letter", "resume", "email", 
            "speech", "newsletter", "poem", "story", "song", "fiction", "imagine", "compose",
            "narrative", "lyrics", "roleplay", "script"
        ],
        patterns: [
            /write\s+(a\s+)?(long|detailed)\s+(article|essay|report|email|letter|speech)/i,
            /write\s+(a|me\s+a|an)\s+(poem|story|song|tale|narrative|script)/i, 
            /imagine\s+(that|if)\b/i
        ]
    },
    {
        intent: "educational",
        weight: 7,
        keywords: [
            "what is", "how does", "define", "teach me", "step by step", "tutorial", 
            "guide", "explain", "clarify", "elaborate on", "concept of", "meaning of"
        ],
        patterns: [/^(what|why|how|when|where|who)\s+/i, /explain\s+(how|why|what)\b/i]
    },
    {
        intent: "simple",
        weight: 5,
        keywords: [
            "hi", "hello", "thanks", "lol", "how are you", "good morning", "jokes", 
            "hey", "yo", "goodbye", "bye", "cool", "okay", "awesome", "summarize",
            "tldr", "brief", "who is", "when did", "price", "weather"
        ],
        patterns: [
            /^(hi|hello|hey|yo|sup|greetings)\b/i, 
            /^(thanks|thank you)/i,
            /\btl;?dr\b/i,
            /in\s+(a\s+)?few\s+(words|sentences)/i
        ]
    }
];

function calculateComplexity(query) {
    let score = 0;
    
    // Length constraints
    if (query.length > 800) score += 4;
    else if (query.length > 400) score += 2;
    else if (query.length > 150) score += 1;
    
    // Code/formatting
    if (/```[\s\S]*```/.test(query) || /`[^`]+`/.test(query)) score += 3;
    
    // Multi-step reasoning
    if (/\b(and also|first.*second.*third|\d\.\s|moreover|furthermore|additionally)\b/i.test(query)) score += 2;
    if (/\b(then|after that|consequently|therefore|if.*then)\b/i.test(query)) score += 2;
    
    // Constraints (e.g. "without using", "must include")
    if (/\b(without|must include|strictly|only use|limit to|max \d+ words)\b/i.test(query)) score += 2;

    // Files attached
    if (/\[Attached Files:.*?\]/i.test(query)) score += 3;

    if (score >= 8) return "high";
    if (score >= 4) return "medium";
    return "low";
}

// Follow-up detection (anaphora resolution hint)
function isFollowUp(query) {
    const text = query.toLowerCase();
    // Words suggesting referring back to previous context or continuation
    if (/^(what about|and|why|how about|tell me more|expand on that|can you|could you|continue|go on|explain more|what am i|who am i)\b/.test(text)) return true;
    if (/\b(he|she|it|they|this|that|these|those)\b/.test(text) && query.split(/\s+/).length < 20) return true;
    // Short queries without clear nouns are usually followups (e.g. "do it", "how?")
    if (query.split(/\s+/).length <= 4 && !/^(hi|hello|hey|start|help)$/i.test(text)) return true;
    return false;
}

// Anti-Hallucination Query Classifier
function checkLiveQuery(query) {
    const text = query.toLowerCase();
    const liveKeywords = [
        "latest", "current", "today", "weather", "stock", "news", 
        "live information", "real-time", "now", "recent", "update"
    ];
    return liveKeywords.some(kw => text.includes(kw));
}

export function detectIntent(query) {
    if (!query || typeof query !== "string") {
        return _build("simple", 20, "low", query, false, false);
    }

    const text = query.toLowerCase();
    const scores = {};

    for (const def of INTENT_MAP) {
        let score = 0;
        for (const kw of def.keywords) {
            // Whole word match for keywords where possible
            const regex = new RegExp(`\\b${kw}\\b`, "i");
            if (regex.test(text)) score += def.weight;
        }
        for (const pattern of def.patterns) {
            if (pattern.test(query)) score += def.weight * 1.5;
        }
        if (score > 0) scores[def.intent] = (scores[def.intent] || 0) + score;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    
    const complexity = calculateComplexity(query);
    const followUp = isFollowUp(query);
    const isLive = checkLiveQuery(query);

    // Fallbacks
    if (!sorted[0]) {
        if (query.length > 50 || followUp) return _build("educational", 30, complexity, query, followUp, isLive);
        return _build("simple", 30, complexity, query, followUp, isLive);
    }

    const [winnerIntent, winnerScore] = sorted[0];
    const maxPossible = Math.max(...INTENT_MAP.map(d => d.weight)) * 10;
    const confidence = Math.min(100, Math.round((winnerScore / maxPossible) * 100));

    return _build(winnerIntent, confidence, complexity, query, followUp, isLive);
}

function _build(intent, confidence, complexity, query = "", isFollowUp = false, isLiveQuery = false) {
    let responseType = "direct answer";
    if (intent === "educational") responseType = complexity === "high" ? "tutorial" : "explanation";
    if (intent === "planning") responseType = "roadmap";
    if (intent === "comparison") responseType = "comparison";
    if (intent === "research") responseType = "research report";
    if (intent === "creative") responseType = "brainstorming";
    if (intent === "coding") responseType = "coding assistant";

    return {
        intent,
        responseType,
        confidence,
        complexity,
        isFollowUp,
        isLiveQuery,
        isLong: query.length > 300,
        hasFile: /\[Attached Files:.*?\]/i.test(query),
        isMultilingual: /[\u0B80-\u0BFF\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF]/.test(query),
        needsSearch: isLiveQuery || intent === "research",
    };
}
