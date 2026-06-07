import { getPineconeIndex } from "../config/pinecone.js";
import { generateEmbedding } from "./embeddingService.js";

/**
 * Retrieve the top-K most semantically relevant chunks across all files uploaded by this user.
 * 
 * @param {string} userId - The user ID to isolate search (multitenancy via namespace)
 * @param {string} query - The user's message
 * @param {number} topK - Number of chunks to retrieve
 * @returns {Array} List of chunks with metadata
 */
export async function retrieveSemanticChunks(userId, query, topK = 3) {
    const index = getPineconeIndex();
    if (!index) {
        console.warn("[RAG] Pinecone not initialized. Skipping retrieval.");
        return [];
    }

    try {
        // 1. Generate embedding for query
        const queryVector = await generateEmbedding(query);

        // 2. Query Pinecone
        // We use the userId as the namespace to ensure total isolation and fast search
        const queryResponse = await index.namespace(userId).query({
            vector: queryVector,
            topK,
            includeMetadata: true
        });

        if (!queryResponse.matches || queryResponse.matches.length === 0) {
            return [];
        }

        // 3. Format results
        return queryResponse.matches.map(match => ({
            score: match.score,
            filename: match.metadata.filename,
            url: match.metadata.url,
            text: match.metadata.text
        }));

    } catch (err) {
        console.error("[RAG ERROR] Failed semantic retrieval:", err.message);
        return [];
    }
}
