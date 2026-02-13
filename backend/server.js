import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import executeController from "./controllers/executeController.js";
import {
  startDebugSession,
  stepForward,
  stepBackward,
  getState,
  endDebugSession,
} from "./controllers/debugController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve frontend
app.use(
  express.static(path.join(__dirname, "../frontend/dist"))
);

// Routes
app.post("/run", executeController);

app.post("/api/debug/start", startDebugSession);
app.post("/api/debug/step-forward", stepForward);
app.post("/api/debug/step-backward", stepBackward);
app.post("/api/debug/get-state", getState);
app.post("/api/debug/end", endDebugSession);

// Health check (keep this ABOVE wildcard in future)
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// React fallback
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/dist/index.html")
  );
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
