/**
 * Memory.js (MongoDB Schema)
 * ---------------------------------------------------------
 * Per-session conversation memory.
 * Phase 3 additions:
 *   - userId       : links session to a user account (Phase 4)
 *   - summary      : auto-generated rolling summary for long chats
 *   - updatedAt    : explicit timestamp for TTL + sort queries
 * ---------------------------------------------------------
 */
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        role : { type: String, enum: ["user", "ai", "system"], required: true },
        text : { type: String, required: true },
        metadata: {
            source_model   : { type: String, default: "auto" },
            privacy_level  : {
                type    : String,
                enum    : ["PRIVATE", "SEMI-SHARED", "GLOBAL"],
                default : "SEMI-SHARED",
            },
            relevance_score : { type: Number, default: 1 },
            intent          : { type: String, default: "" },
        },
    },
    { _id: false, timestamps: { createdAt: "createdAt", updatedAt: false } }
);

const memorySchema = new mongoose.Schema(
    {
        sessionId : { type: String, required: true, unique: true, index: true },
        userId    : { type: String, default: "anonymous", index: true },

        messages  : {
            type    : [messageSchema],
            default : [],
        },

        // Rolling AI-generated summary (refreshed every N messages)
        summary   : { type: String, default: "" },

        // Metadata
        messageCount : { type: Number, default: 0 },
    },
    {
        timestamps : true,   // adds createdAt + updatedAt at document level
    }
);

// Index for global memory queries (cross-session, sorted by recency)
memorySchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("Memory", memorySchema);