import express from "express";
import { register, login, googleLogin, guestLogin, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/guest", guestLogin);
router.get("/me", protect, getMe);

export default router;
