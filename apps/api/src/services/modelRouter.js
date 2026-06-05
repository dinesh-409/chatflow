export const chooseModel = (message, mode = "auto") => {
    if (mode !== "auto") return mode;

    const text = message.toLowerCase();

    // 🌐 Language Detection (Heuristic for Tamil/Tanglish)
    const isTamil = /[\u0B80-\u0BFF]/.test(text) || /\b(eppadi|enna|vanakkam|sollu|puriyada|nanba|thambi|machan)\b/.test(text);

    // 1. Language & Casual Intent
    if (isTamil || text.includes("casual") || text.includes("chat") || text.includes("hi") || text.includes("hello")) {
        return "gemini"; // Multilingual + fast context
    }

    // 2. Current Affairs / Factual (Needs Search + GPT/Gemini)
    if (shouldUseWebSearch(message)) {
        return "openrouter"; // GPT-4o is best at synthesizing search results
    }

    // 3. Coding / Instruction Following Intent
    if (
        text.includes("code") ||
        text.includes("fix") ||
        text.includes("build") ||
        text.includes("command") ||
        text.includes("instruct") ||
        text.includes("error")
    ) {
        return "openrouter"; // ChatGPT preferred for coding/instructions
    }

    // 4. Deep Analysis / Compare / Design Intent
    if (
        text.includes("analyze") ||
        text.includes("compare") ||
        text.includes("design") ||
        text.includes("architecture") ||
        text.includes("explain") ||
        text.length > 500
    ) {
        return "openrouter"; 
    }

    // 5. Summarize / Fast Intent
    if (
        text.includes("summarize") ||
        text.includes("short") ||
        text.length < 50
    ) {
        return "groq"; // Fast Llama
    }

    // Default fallback
    return "gemini";
};

// 🌍 Real-Time Knowledge Router
export const shouldUseWebSearch = (message) => {
    const text = message.toLowerCase();
    const factualKeywords = [
        "today", "now", "latest", "news", "current", "price", 
        "president", "election", "match", "score", "weather",
        "who is", "what is the status", "update"
    ];
    
    return factualKeywords.some(keyword => text.includes(keyword));
};