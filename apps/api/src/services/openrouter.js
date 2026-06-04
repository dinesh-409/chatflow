import axios from "axios";

export async function askOpenRouter(prompt) {
    const key = process.env.OPENROUTER_API_KEY;

    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "meta-llama/llama-3-8b-instruct",
            messages: [{ role: "user", content: prompt }],
        },
        {
            headers: {
                Authorization: `Bearer ${key}`,
            },
        }
    );

    return res.data.choices[0].message.content;
}