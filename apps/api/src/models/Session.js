import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            index: true
        },

        userId: {
            type: String,
            required: true,
            index: true
        },

        title: {
            type: String,
            default: "New Chat"
        },

        isPinned: {
            type: Boolean,
            default: false
        },

        isArchived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// One user cannot have duplicate sessionIds
sessionSchema.index(
    { userId: 1, sessionId: 1 },
    { unique: true }
);

export default mongoose.model("Session", sessionSchema);