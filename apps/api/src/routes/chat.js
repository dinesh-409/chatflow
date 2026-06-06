import express from "express";
import { handleBasicChat, handleChatStream } from "../controllers/chatController.js";

const router = express.Router();

// New basic endpoint for Phase 1 dummy response & future routing preparation
router.post("/chat", handleBasicChat);

// Advanced streaming chat endpoint
router.post("/chat-stream", handleChatStream);

export default router;