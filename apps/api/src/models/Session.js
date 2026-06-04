import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    title: { type: String, default: "New Chat" },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Session", sessionSchema);