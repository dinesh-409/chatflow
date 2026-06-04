export function selectModel(task) {

    if (task === "simple") {
        return "groq"; // FAST + FREE
    }

    if (task === "coding") {
        return "gemini"; // BEST QUALITY
    }

    if (task === "reasoning") {
        return "gemini";
    }

    if (task === "long") {
        return "gemini";
    }

    return "groq"; // default fast
}