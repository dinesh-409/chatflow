import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    role: String,
    text: String,
});

const chatSchema = new mongoose.Schema({
    sessionId: String,
    title: String,
    messages: [messageSchema],
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Chat", chatSchema);