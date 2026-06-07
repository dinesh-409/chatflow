import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true
        },
        passwordHash: {
            type: String,
        },
        googleId: {
            type: String,
            sparse: true,
            unique: true
        },
        name: {
            type: String,
            default: "Anonymous User"
        },
        avatar: {
            type: String,
            default: ""
        },
        isGuest: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);
