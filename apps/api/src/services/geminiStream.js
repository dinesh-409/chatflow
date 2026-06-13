import axios from "axios";
import { geminiBaseUrl } from "../config/modelConfig.js";

export async function askGeminiStream(prompt) {
    const key = process.env.GEMINI_API_KEY;

    const res = await axios({
        method: "post",
        url: `${geminiBaseUrl("streamGenerateContent")}?key=${key}`,
        data: {
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
        },
        responseType: "stream",
    });

    // convert raw stream → async iterator
    const stream = res.data;

    async function* generator() {
        for await (const chunk of stream) {
            const text = chunk.toString();
            yield text;
        }
    }

    return generator();
}