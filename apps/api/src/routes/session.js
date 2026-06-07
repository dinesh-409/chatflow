import express from "express";
import {
    getAllSessions,
    getSession,
    updateSession,
    deleteSession
} from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/sessions", protect, getAllSessions);
router.get("/sessions/:id", protect, getSession);
router.put("/sessions/:id", protect, updateSession);
router.delete("/sessions/:id", protect, deleteSession);

export default router;