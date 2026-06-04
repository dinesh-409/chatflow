export function classifyTask(text) {

    const msg = text.toLowerCase();

    if (msg.length < 20) return "simple";

    if (msg.includes("code") || msg.includes("build") || msg.includes("app")) {
        return "coding";
    }

    if (msg.includes("why") || msg.includes("explain")) {
        return "reasoning";
    }

    if (msg.includes("long") || msg.includes("document")) {
        return "long";
    }

    return "general";
}