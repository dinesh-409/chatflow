import express from "express";
import { handleBasicChat, handleChatStream } from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// New basic endpoint for Phase 1 dummy response & future routing preparation
router.post("/chat", protect, handleBasicChat);

// Advanced streaming chat endpoint
router.post("/chat-stream", protect, handleChatStream);

export default router;