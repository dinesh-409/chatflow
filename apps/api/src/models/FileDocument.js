import mongoose from "mongoose";

const fileDocumentSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true },
        sessionId: { type: String, required: true, index: true },
        filename: { type: String, required: true },
        url: { type: String, required: true },
        ext: { type: String },
        summary: { type: String, default: "" },
        chunks: { type: [String], default: [] },
        charCount: { type: Number, default: 0 }
    },
    { timestamps: true }
);

// Index for efficient token-overlap searching over all chunks of a specific session
fileDocumentSchema.index({ sessionId: 1, userId: 1 });

export default mongoose.model("FileDocument", fileDocumentSchema);
