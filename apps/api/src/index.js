import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db/mongo.js";
import chatRoutes from "./routes/chat.js";
import sessionRoutes from "./routes/session.js";

dotenv.config();

const app = express();

/* =====================
   MIDDLEWARE
===================== */
app.use(cors({
    origin: [
        "http://localhost:3000",
        process.env.FRONTEND_URL
    ],
    credentials: true
}));

app.use(express.json());

/* =====================
   DB CONNECT
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
    res.send("🔥 ChatFlow Backend Running");
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});