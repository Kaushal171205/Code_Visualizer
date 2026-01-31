import express from "express";
import cors from "cors";
import executeController from "./controllers/executeController.js";
import {
    startDebugSession,
    stepForward,
    stepBackward,
    getState,
    endDebugSession,
} from "./controllers/debugController.js";

const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Code execution routes
app.post("/run", executeController);

// Debug/Visualization routes
app.post("/api/debug/start", startDebugSession);
app.post("/api/debug/step-forward", stepForward);
app.post("/api/debug/step-backward", stepBackward);
app.post("/api/debug/get-state", getState);
app.post("/api/debug/end", endDebugSession);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});