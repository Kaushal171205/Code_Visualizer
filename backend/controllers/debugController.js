import lldbService from "../services/lldbService.js";

/**
 * Debug Controller - Handles visualization debug sessions
 */

/**
 * Start a new debug session
 * POST /api/debug/start
 */
export const startDebugSession = async (req, res) => {
    const { code, language } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            error: "Code is required",
        });
    }

    if (language !== "cpp" && language !== "c") {
        return res.status(400).json({
            success: false,
            error: "Only C++ visualization is currently supported",
        });
    }

    try {
        const result = await lldbService.startSession(code);
        return res.json(result);
    } catch (error) {
        console.error("Debug session error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to start debug session",
            details: error.message,
        });
    }
};

/**
 * Step forward in debug session
 * POST /api/debug/step-forward
 */
export const stepForward = (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: "Session ID is required",
        });
    }

    const result = lldbService.stepForward(sessionId);
    return res.json(result);
};

/**
 * Step backward in debug session
 * POST /api/debug/step-backward
 */
export const stepBackward = (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: "Session ID is required",
        });
    }

    const result = lldbService.stepBackward(sessionId);
    return res.json(result);
};

/**
 * Get state at specific step
 * POST /api/debug/get-state
 */
export const getState = (req, res) => {
    const { sessionId, step } = req.body;

    if (!sessionId || step === undefined) {
        return res.status(400).json({
            success: false,
            error: "Session ID and step are required",
        });
    }

    const result = lldbService.getState(sessionId, step);
    return res.json(result);
};

/**
 * End debug session
 * POST /api/debug/end
 */
export const endDebugSession = (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: "Session ID is required",
        });
    }

    const result = lldbService.endSession(sessionId);
    return res.json(result);
};

export default {
    startDebugSession,
    stepForward,
    stepBackward,
    getState,
    endDebugSession,
};
