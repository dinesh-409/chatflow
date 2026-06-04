import axios from "axios";

export async function askGroqStream(prompt) {
    const key = process.env.GROQ_API_KEY;

    const res = await axios({
        method: "post",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
        },
        data: {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            stream: true,
        },
        responseType: "stream",
    });

    const stream = res.data;

    async function* generator() {
        for await (const chunk of stream) {
            const text = chunk.toString();
            yield text;
        }
    }

    return generator();
}