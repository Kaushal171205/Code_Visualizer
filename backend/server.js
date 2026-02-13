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

// App config
const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || "development";

/* -------------------- SECURITY & PERFORMANCE -------------------- */

// Helmet – relaxed for Monaco & Vite
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiting
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
    origin: "*",
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

const frontendPath = path.join(__dirname, "../frontend/dist");

// Serve static frontend only if it exists (Docker / Render)
app.use(express.static(frontendPath));

// React / Vite fallback (don’t break APIs)
app.get(/^(?!\/api|\/run|\/health).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* -------------------- ERROR HANDLER -------------------- */

app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

/* -------------------- START SERVER -------------------- */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT} (${NODE_ENV})`);
});
