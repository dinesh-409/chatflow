import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./db/mongo.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import sessionRoutes from "./routes/session.js";
import uploadRoutes from "./routes/upload.js";
import path from "path";

dotenv.config();

/* =====================
   SETUP VALIDATION
===================== */
const requiredEnvVars = ["PORT", "JWT_SECRET", "MONGO_URI", "GEMINI_API_KEY"];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

const app = express();

/* =====================
   CORS
===================== */

const allowedOrigins = [
   "http://localhost:3000",
   "https://chatflow-taupe.vercel.app",
   "https://chatflow-mg55x5s90-dinesh-s-projects20.vercel.app",
   process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
   cors({
      origin: (origin, callback) => {
         if (!origin) {
            return callback(null, true);
         }

         if (allowedOrigins.includes(origin)) {
            return callback(null, true);
         }

         console.log("❌ Blocked Origin:", origin);

         return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
   })
);

/* =====================
   BODY PARSER
===================== */

app.use(express.json({ limit: "10mb" }));

/* =====================
   DATABASE & VECTOR DB
===================== */

connectDB();
import { initPinecone, getPineconeIndex } from "./config/pinecone.js";
initPinecone();

/* =====================
   ROUTES
===================== */

app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", sessionRoutes);
app.use("/api", uploadRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* =====================
   HEALTH CHECK
===================== */

app.get("/", (req, res) => {
   res.status(200).send("🔥 ChatFlow Backend Running");
});

import mongoose from "mongoose";

app.get("/health", async (req, res) => {
   const health = {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
         mongodb: "unknown",
         pinecone: "unknown",
      }
   };

   // Check MongoDB
   try {
      health.services.mongodb = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
   } catch { health.services.mongodb = "error"; }

   // Check Pinecone
   try {
      health.services.pinecone = getPineconeIndex() ? "connected" : "not_initialized";
   } catch { health.services.pinecone = "error"; }

   const allHealthy = Object.values(health.services).every(s => s === "connected");
   health.status = allHealthy ? "healthy" : "degraded";

   res.status(allHealthy ? 200 : 503).json(health);
});

/* =====================
   GLOBAL ERROR HANDLER
===================== */
app.use((err, req, res, next) => {
   console.error("🔥 [Global Error]:", err.stack);
   res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error"
   });
});

/* =====================
   START SERVER
===================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
   console.log(`🚀 Server running on port ${PORT}`);
   console.log("🌐 Allowed Origins:", allowedOrigins);
});