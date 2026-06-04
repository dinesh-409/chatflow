import axios from "axios";

export async function askGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;

    const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`,
        {
            contents: [{ parts: [{ text: prompt }] }],
        }
    );

    return res.data.candidates[0].content.parts[0].text;
}