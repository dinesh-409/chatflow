export const chooseModel = (message, mode = "auto") => {
    if (mode !== "auto") return mode;

    const text = message.toLowerCase();

    // 🧠 coding / reasoning → Gemini
    if (
        text.includes("code") ||
        text.includes("fix") ||
        text.includes("explain") ||
        text.includes("bug")
    ) {
        return "gemini";
    }

    // ⚡ fast replies → Groq
    if (
        text.includes("hi") ||
        text.includes("hello") ||
        text.length < 20
    ) {
        return "groq";
    }

    // 🌐 default → OpenRouter
    return "openrouter";
};