import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./db/mongo.js";
import chatRoutes from "./routes/chat.js";
import sessionRoutes from "./routes/session.js";

dotenv.config();

const app = express();

/* =====================
   CORS
===================== */

const allowedOrigins = [
   "http://localhost:3000",
   process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
   cors({
      origin: (origin, callback) => {
         // Allow Postman, Render health checks, server-to-server calls
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

app.use(express.json());

/* =====================
   DATABASE
===================== */

connectDB();

/* =====================
   ROUTES
===================== */

app.use("/api", chatRoutes);
app.use("/api", sessionRoutes);

/* =====================
   HEALTH CHECK
===================== */

app.get("/", (req, res) => {
   res.status(200).send("🔥 ChatFlow Backend Running");
});

/* =====================
   START SERVER
===================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
   console.log(`🚀 Server running on port ${PORT}`);
   console.log("🌐 Allowed Origins:", allowedOrigins);
});