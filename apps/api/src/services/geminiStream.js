import axios from "axios";

export async function askGeminiStream(prompt) {
    const key = process.env.GEMINI_API_KEY;

    const res = await axios({
        method: "post",
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${key}`,
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