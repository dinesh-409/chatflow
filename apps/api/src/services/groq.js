import axios from "axios";

export async function askGroq(prompt) {
    const key = process.env.GROQ_API_KEY;

    const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
        },
        {
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
        }
    );

    return res.data.choices[0].message.content;
}