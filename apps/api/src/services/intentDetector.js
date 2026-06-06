/**
 * intentDetector.js  — Phase 3 Fix
 * ---------------------------------------------------------
 * Adds "creative" and "news" intent buckets.
 * Fixes weight ordering so news/creative win over generic explain.
 * ---------------------------------------------------------
 */

const INTENT_MAP = [
    {
        intent  : "coding",
        weight  : 10,
        keywords: [
            "code", "debug", "fix", "error", "bug", "function", "class",
            "variable", "compile", "build", "deploy", "git", "loop", "array",
            "object", "api", "endpoint", "database", "query", "syntax",
            "algorithm", "script", "program", "implement", "refactor",
            "typescript", "javascript", "python", "java", "golang", "rust",
            "html", "css", "react", "node", "express", "sql", "bash", "shell",
        ],
        patterns: [
            /```[\s\S]*```/,
            /\b(def |const |let |var |function |import |export )/,
            /\b(npm|pip|yarn|cargo)\b/i,
            /TypeError|SyntaxError|ReferenceError/,
        ],
    },
    {
        intent  : "analysis",
        weight  : 9,
        keywords: [
            "analyze", "analysis", "compare", "contrast", "evaluate", "assess",
            "architecture", "design", "diagram", "trade-off", "pros and cons",
            "difference between", "which is better", "performance",
            "scalability", "security", "deep dive", "breakdown",
        ],
        patterns: [
            /\b(pros|cons)\b/i,
            /compare\s+\w+\s+(vs?\.?|and|with)\s+\w+/i,
        ],
    },

    // ── NEW: News / Real-time (high weight so it beats generic explain) ──
    {
        intent  : "news",
        weight  : 9,
        keywords: [
            "news", "latest", "breaking", "today", "this week", "this month",
            "current events", "happening", "live update", "trending",
            "headline", "report", "announcement", "press release",
        ],
        patterns: [
            /\b(latest|breaking|live)\s+(news|update|report)/i,
            /what('s|\s+is)\s+(happening|going on)/i,
        ],
    },

    {
        intent  : "factual",
        weight  : 8,
        keywords: [
            "who is", "what is the", "when did", "price", "stock", "weather",
            "president", "election", "result", "match", "score", "now",
            "update", "recent", "real-time", "happened", "as of",
            "what is the status",
        ],
        patterns: [
            /\b(in \d{4}|as of|right now|at the moment)\b/i,
            /current(ly)?\s+(running|available|price|version)/i,
        ],
    },

    {
        intent  : "summarize",
        weight  : 8,
        keywords: [
            "summarize", "summary", "tldr", "shorten", "brief", "condense",
            "key points", "main points", "highlight", "abstract", "overview",
        ],
        patterns: [
            /\btl;?dr\b/i,
            /in\s+(a\s+)?few\s+words/i,
        ],
    },

    // ── NEW: Creative writing ──
    {
        intent  : "creative",
        weight  : 8,
        keywords: [
            "write a story", "write a poem", "write a song", "creative",
            "fiction", "short story", "narrative", "poem", "lyrics",
            "once upon a time", "imagine", "create a character",
            "write me a", "make up a", "invent a", "compose a",
            "screenplay", "dialogue", "plot", "protagonist", "villain",
        ],
        patterns: [
            /write\s+(a|me\s+a|an)\s+(poem|story|song|tale|narrative|script)/i,
            /\b(creative|fiction|imagin)/i,
        ],
    },

    {
        intent  : "explain",
        weight  : 7,
        keywords: [
            "explain", "what is", "how does", "what are", "why is", "why does",
            "describe", "definition", "define", "meaning", "concept", "teach",
            "how to", "tutorial", "guide", "walk me through", "step by step",
        ],
        patterns: [
            /^(what|why|how|when|where|who)\s+/i,
        ],
    },

    {
        intent  : "casual",
        weight  : 5,
        keywords: [
            "hi", "hello", "hey", "sup", "howdy", "yo", "good morning",
            "good evening", "how are you", "what's up", "tell me a joke",
            "thanks", "thank you", "cool", "nice", "great", "awesome", "lol",
        ],
        patterns: [
            /^(hi|hello|hey|yo|sup)\b/i,
        ],
    },

    {
        intent  : "multilingual",
        weight  : 6,
        keywords: [
            "eppadi", "enna", "vanakkam", "sollu", "puriyada",
            "nanba", "thambi", "machan",
        ],
        patterns: [
            /[\u0B80-\u0BFF]/,
            /[\u0600-\u06FF]/,
            /[\u4E00-\u9FFF]/,
            /[\u0400-\u04FF]/,
        ],
    },
];

/**
 * detectIntent(query) → IntentResult
 */
export function detectIntent(query) {
    if (!query || typeof query !== "string") {
        return _build("casual", 20, ["empty-input"], query);
    }

    const text    = query.toLowerCase();
    const scores  = {};
    const signals = {};

    for (const def of INTENT_MAP) {
        let score = 0;
        const triggered = [];

        for (const kw of def.keywords) {
            if (text.includes(kw)) {
                score += def.weight;
                triggered.push(`kw:"${kw}"`);
            }
        }
        for (const pattern of def.patterns) {
            if (pattern.test(query)) {
                score += def.weight * 1.5;
                triggered.push(`pat:${pattern.source.slice(0, 20)}`);
            }
        }

        if (score > 0) {
            scores[def.intent]  = (scores[def.intent]  || 0) + score;
            signals[def.intent] = (signals[def.intent] || []).concat(triggered);
        }
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return _build("casual", 30, ["no-signals"], query);

    const [winnerIntent, winnerScore] = sorted[0];
    const maxPossible = Math.max(...INTENT_MAP.map(d => d.weight)) * 10;
    const confidence  = Math.min(100, Math.round((winnerScore / maxPossible) * 100));

    return _build(winnerIntent, confidence, signals[winnerIntent] || [], query);
}

function _build(intent, confidence, signals, query = "") {
    return {
        intent,
        confidence,
        signals,
        isLong         : query.length > 300,
        hasCode        : /```[\s\S]*```/.test(query) || /`[^`]+`/.test(query),
        isMultilingual : /[\u0B80-\u0BFF\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF]/.test(query),
    };
}
