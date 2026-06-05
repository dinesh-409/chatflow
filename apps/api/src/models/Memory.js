import mongoose from "mongoose";

const memorySchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
    },

    messages: [
        {
            role: String,
            text: String,
            createdAt: {
                type: Date,
                default: Date.now,
            },
            metadata: {
                source_model: { type: String, default: "auto" },
                privacy_level: { type: String, enum: ["PRIVATE", "SEMI-SHARED", "GLOBAL"], default: "SEMI-SHARED" },
                relevance_score: { type: Number, default: 1 }
            }
        },
    ],

    summary: {
        type: String,
        default: "",
    },
});

export default mongoose.model(
    "Memory",
    memorySchema
);