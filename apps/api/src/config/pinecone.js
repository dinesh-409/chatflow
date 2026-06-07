import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

let pineconeClient = null;
let index = null;

export const initPinecone = async () => {
    if (!process.env.PINECONE_API_KEY) {
        console.warn("[PINECONE] Missing PINECONE_API_KEY in environment. RAG features will be disabled.");
        return null;
    }
    try {
        pineconeClient = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        index = pineconeClient.index('chatflow');
        console.log("[PINECONE] Successfully connected to 'chatflow' index.");
        return index;
    } catch (error) {
        console.error("[PINECONE] Failed to initialize:", error.message);
        return null;
    }
};

export const getPineconeIndex = () => index;
