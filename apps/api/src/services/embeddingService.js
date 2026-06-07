import axios from "axios";

/**
 * Generate a 768-dimensional semantic embedding for the given text
 * using Google's text-embedding-004 model.
 * 
 * @param {string} text The chunk or query text to embed
 * @returns {number[]} The 768-d vector
 */
export async function generateEmbedding(text) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY for embedding generation.");
    }
    
    // Clean text
    const cleanText = text.replace(/\n/g, " ");

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
            model: "models/text-embedding-004",
            content: {
                parts: [{ text: cleanText }]
            }
        },
        {
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    if (response.data && response.data.embedding && response.data.embedding.values) {
        return response.data.embedding.values;
    }

    throw new Error("Failed to generate embedding: Invalid API response");
}
