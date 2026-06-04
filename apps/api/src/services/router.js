import { askGemini } from "./gemini.js";
import { askGroq } from "./groq.js";
import { classifyTask } from "./classifier.js";
import { selectModel } from "./modelSelector.js";

import { saveMemory, getMemory } from "./memory.js";

export async function aiRouter({ message, mode = "auto", model, user = "default" }) {

    // =====================
    // GET MEMORY (CONTEXT)
    // =====================
    let historyText = "";

    getMemory(user, (err, rows) => {
        if (!err && rows) {
            historyText = rows
                .map((m) => `${m.role}: ${m.message}`)
                .join("\n");
        }
    });

    const finalPrompt = `
You are ChatFlow AI.

Conversation History:
${historyText}

User: ${message}
`;

    // =====================
    // SAVE USER MESSAGE
    // =====================
    saveMemory(user, message, "user");

    let reply;

    // =====================
    // MODEL SELECTION
    // =====================
    const task = classifyTask(message);
    const selected = selectModel(task);

    if (mode === "manual") {
        if (model === "gemini") reply = await askGemini(finalPrompt);
        if (model === "groq") reply = await askGroq(finalPrompt);
    } else {
        if (selected === "gemini") reply = await askGemini(finalPrompt);
        if (selected === "groq") reply = await askGroq(finalPrompt);
    }

    // =====================
    // SAVE AI RESPONSE
    // =====================
    saveMemory(user, reply, "ai");

    return reply;
}