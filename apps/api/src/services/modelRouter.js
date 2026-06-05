export const chooseModel = (message, mode = "auto") => {
    if (mode !== "auto") return mode;

    const text = message.toLowerCase();

    // 🌐 Language Detection (Heuristic for Tamil/Tanglish)
    const isTamil = /[\u0B80-\u0BFF]/.test(text) || /\b(eppadi|enna|vanakkam|sollu|puriyada|nanba|thambi|machan)\b/.test(text);

    // 1. Language & Casual Intent
    if (isTamil || text.includes("casual") || text.includes("chat") || text.includes("hi") || text.includes("hello")) {
        return "gemini"; // Multilingual + fast context
    }

    // 2. Coding / Instruction Following Intent
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

    // 3. Deep Analysis / Compare / Design Intent
    if (
        text.includes("analyze") ||
        text.includes("compare") ||
        text.includes("design") ||
        text.includes("architecture") ||
        text.includes("explain") ||
        text.length > 500
    ) {
        // Maps to Claude/Deep Analysis via OpenRouter
        return "openrouter"; 
    }

    // 4. Summarize / Fast Intent
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