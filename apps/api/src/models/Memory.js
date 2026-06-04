import mongoose from "mongoose";

const memorySchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    messages: [
        {
            role: String,
            text: String,
            createdAt: { type: Date, default: Date.now }
        }
    ],
    summary: { type: String, default: "" }
});

export default mongoose.model("Memory", memorySchema);