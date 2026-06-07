/**
 * GlobalMemory.js (MongoDB Schema)
 * ---------------------------------------------------------
 * Cross-session user intelligent memory system.
 * One document per userId.
 * ---------------------------------------------------------
 */
import mongoose from "mongoose";

const globalMemorySchema = new mongoose.Schema(
    {
        userId         : { type: String, required: true, unique: true, index: true },
        
        // Intelligent Memory Categories
        profile        : { type: [String], default: [] }, // Profile Memory (e.g. "Name: Dinesh")
        preferences    : { type: [String], default: [] }, // Preference Memory
        projects       : { type: [String], default: [] }, // Project Memory
        education      : { type: [String], default: [] }, // Educational Memory
        goals          : { type: [String], default: [] }, // User Goal Tracking
        longTermFacts  : { type: [String], default: [] }, // Long-Term Memory (General persistent facts)

        // Legacy / Fallback for broad context
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
