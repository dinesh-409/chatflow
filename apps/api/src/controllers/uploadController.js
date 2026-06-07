import FileDocument from "../models/FileDocument.js";
import { parseFile } from "../services/fileService.js";
import { generateEmbedding } from "../services/embeddingService.js";
import { getPineconeIndex } from "../config/pinecone.js";
import { v4 as uuidv4 } from "uuid";

export const handleUpload = async (req, res) => {
    try {
        const files = req.files;
        const sessionId = req.body.sessionId;
        const userId = req.user?.id; // from authMiddleware

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId required in form data" });
        }
        
        const fileUrls = [];

        // We process them sequentially or in parallel. Let's do sequentially to avoid spiking RAM on large OCR tasks
        for (const f of files) {
            const url = `/uploads/${f.filename}`;
            fileUrls.push(url);

            try {
                // Background processing: parse and store
                const parsed = await parseFile(url, { summarize: true });
                
                await FileDocument.create({
                    userId,
                    sessionId,
                    filename: f.originalname,
                    url,
                    ext: parsed.ext,
                    summary: parsed.summary,
                    chunks: parsed.chunks,
                    charCount: parsed.charCount
                });
                console.log(`[UPLOAD] Processed and stored document chunks for ${f.originalname}`);

                // RAG: Generate embeddings and upsert to Pinecone
                const index = getPineconeIndex();
                if (index && parsed.chunks.length > 0) {
                    const vectors = [];
                    for (let i = 0; i < parsed.chunks.length; i++) {
                        try {
                            const chunkText = parsed.chunks[i];
                            const embedding = await generateEmbedding(chunkText);
                            vectors.push({
                                id: uuidv4(),
                                values: embedding,
                                metadata: {
                                    userId,
                                    filename: f.originalname,
                                    url,
                                    text: chunkText,
                                    chunkIndex: i
                                }
                            });
                        } catch (e) {
                            console.error(`[RAG] Failed to embed chunk ${i} of ${f.originalname}`, e.message);
                        }
                    }

                    if (vectors.length > 0) {
                        // Upsert into user's namespace for multitenancy
                        await index.namespace(userId).upsert(vectors);
                        console.log(`[RAG] Upserted ${vectors.length} vectors to Pinecone for ${f.originalname}`);
                    }
                }

            } catch (err) {
                console.error(`[UPLOAD ERROR] Failed to parse ${f.originalname}:`, err.message);
                // Even if parsing fails, we keep the file URL so the UI doesn't crash
            }
        }

        res.json({ urls: fileUrls });
    } catch (err) {
        console.error("[UPLOAD CRITICAL ERROR]", err);
        res.status(500).json({ error: err.message });
    }
};
