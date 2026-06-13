import express from "express";

import {
    getAllSessions,
    getSession,
    updateSession,
    deleteSession,
} from "../controllers/sessionController.js";

import {
    protect,
} from "../middleware/authMiddleware.js";

const router =
    express.Router();

router.use(protect);

router.get(
    "/sessions",
    getAllSessions
);

router.get(
    "/sessions/:id",
    getSession
);

router.put(
    "/sessions/:id",
    updateSession
);

router.delete(
    "/sessions/:id",
    deleteSession
);

export default router;