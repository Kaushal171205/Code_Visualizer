import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Load environment variables
dotenv.config();

// Controllers
import executeController from "./controllers/executeController.js";
import {
  startDebugSession,
  stepForward,
  stepBackward,
  getState,
  endDebugSession,
} from "./controllers/debugController.js";

// ESM dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || "development";

/* -------------------- SECURITY & PERFORMANCE -------------------- */

// Helmet (relaxed CSP for Monaco + Vite)
app.use(
  helmet({
    contentSecurityPolicy: false, // 🔥 IMPORTANT: disable CSP to avoid Monaco issues
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// Rate Limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* -------------------- MIDDLEWARE -------------------- */

app.use(
  cors({
    origin: "*", // tighten later if needed
  })
);

app.use(express.json({ limit: "10mb" }));

/* -------------------- API ROUTES -------------------- */

app.post("/run", executeController);

app.post("/api/debug/start", startDebugSession);
app.post("/api/debug/step-forward", stepForward);
app.post("/api/debug/step-backward", stepBackward);
app.post("/api/debug/get-state", getState);
app.post("/api/debug/end", endDebugSession);

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: NODE_ENV });
});

/* -------------------- FRONTEND SERVING -------------------- */

// Only serve frontend in production (Docker / Render)
if (NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend/dist");

  app.use(express.static(frontendPath));

  // React / Vite fallback
  app.get(/^(?!\/api|\/run|\/health).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

/* -------------------- ERROR HANDLER -------------------- */

app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

/* -------------------- START SERVER -------------------- */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${NODE_ENV})`);
});
