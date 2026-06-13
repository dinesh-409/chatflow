import axios from "axios";
import { geminiBaseUrl } from "../config/modelConfig.js";

export async function askGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;

    const res = await axios.post(
        `${geminiBaseUrl("generateContent")}?key=${key}`,
        {
            contents: [{ parts: [{ text: prompt }] }],
        }
    );

    return res.data.candidates[0].content.parts[0].text;
}