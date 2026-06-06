import express from "express";
import {
    getAllSessions,
    getSession,
    updateSession,
    deleteSession
} from "../controllers/sessionController.js";

const router = express.Router();

router.get("/sessions", getAllSessions);
router.get("/sessions/:id", getSession);
router.put("/sessions/:id", updateSession);
router.delete("/sessions/:id", deleteSession);

export default router;