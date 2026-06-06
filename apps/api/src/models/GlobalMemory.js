/**
 * GlobalMemory.js (MongoDB Schema)
 * ---------------------------------------------------------
 * Cross-session user preferences and persistent facts.
 * One document per userId.
 *
 * Populated by memoryService when a GLOBAL-classified
 * message is detected (e.g. "My name is Dinesh",
 * "Always respond in Tamil", "Prefer short answers").
 * ---------------------------------------------------------
 */
import mongoose from "mongoose";

const preferenceSchema = new mongoose.Schema(
    {
        key       : { type: String, required: true },  // e.g. "name", "language", "response_style"
        value     : { type: String, required: true },  // e.g. "Dinesh", "Tamil", "brief"
        updatedAt : { type: Date, default: Date.now },
    },
    { _id: false }
);

const globalMemorySchema = new mongoose.Schema(
    {
        userId      : { type: String, required: true, unique: true, index: true },
        preferences : { type: [preferenceSchema], default: [] },

        // High-relevance facts extracted across all sessions
        facts       : { type: [String], default: [] },

        // Raw recent GLOBAL-level messages for prompt injection
        globalMessages: [
            {
                role      : String,
                text      : String,
                sessionId : String,
                createdAt : { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model("GlobalMemory", globalMemorySchema);
