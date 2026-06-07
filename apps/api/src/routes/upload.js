import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { handleUpload } from "../controllers/uploadController.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`);
    }
});

const upload = multer({ storage });

import { protect } from "../middleware/authMiddleware.js";

router.post("/upload", protect, upload.array("files"), handleUpload);

export default router;
