import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import VisualizationCanvas from "../components/VisualizationCanvas";
import PlaybackControls from "../components/PlaybackControls";
import "../styles/Visualizer.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

const CODE_TEMPLATES = {
    cpp: `#include <iostream>
using namespace std;

int main() {
    int x = 10;
    int y = 20;
    int sum = x + y;
    
    int arr[5] = {1, 2, 3, 4, 5};
    
    cout << "Sum: " << sum << endl;
    return 0;
}
`,
    linkedlist: `#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
};

int main() {
    Node* head = new Node();
    head->data = 10;
    
    Node* second = new Node();
    second->data = 20;
    head->next = second;
    
    Node* third = new Node();
    third->data = 30;
    second->next = third;
    third->next = nullptr;
    
    // Traverse
    Node* current = head;
    while (current != nullptr) {
        cout << current->data << " ";
        current = current->next;
    }
    
    return 0;
}
`,
};

const Visualizer = ({ theme }) => {
    const [code, setCode] = useState(CODE_TEMPLATES.cpp);
    const [sessionId, setSessionId] = useState(null);
    const [currentState, setCurrentState] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [totalSteps, setTotalSteps] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Start visualization
    const handleStartVisualization = async () => {
        setIsLoading(true);
        setError(null);
        setSessionId(null);
        setCurrentState(null);
        setCurrentStep(0);
        setTotalSteps(0);

        try {
            const response = await fetch(`${API_URL}/api/debug/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, language: "cpp" }),
            });

            const data = await response.json();

            if (data.success) {
                setSessionId(data.sessionId);
                setTotalSteps(data.totalSteps);
                setCurrentState(data.initialState);
                setCurrentStep(0);
            } else {
                setError({
                    type: data.error || "Error",
                    message: data.details || "Failed to start visualization",
                });
            }
        } catch (err) {
            setError({
                type: "Connection Error",
                message: "Cannot connect to server. Make sure backend is running.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Step forward
    const handleStepForward = async () => {
        if (!sessionId) return;

        try {
            const response = await fetch(`${API_URL}/api/debug/step-forward`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            });

            const data = await response.json();

            if (data.success) {
                setCurrentState(data.state);
                setCurrentStep(data.step);
            }
        } catch (err) {
            console.error("Step forward error:", err);
        }
    };

    // Step backward
    const handleStepBackward = async () => {
        if (!sessionId) return;

        try {
            const response = await fetch(`${API_URL}/api/debug/step-backward`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            });

            const data = await response.json();

            if (data.success) {
                setCurrentState(data.state);
                setCurrentStep(data.step);
            }
        } catch (err) {
            console.error("Step backward error:", err);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "ArrowRight" && sessionId) {
                handleStepForward();
            } else if (e.key === "ArrowLeft" && sessionId) {
                handleStepBackward();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sessionId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionId) {
                fetch(`${API_URL}/api/debug/end`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId }),
                }).catch(() => { });
            }
        };
    }, [sessionId]);

    return (
        <div className={`visualizer ${theme}`}>
            <div className="visualizer-container">
                {/* Left Panel - Code Editor */}
                <div className="code-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <span className="icon">📝</span>
                            Code Editor
                        </div>
                        <div className="template-buttons">
                            <button
                                className="template-btn"
                                onClick={() => setCode(CODE_TEMPLATES.cpp)}
                            >
                                Basic
                            </button>
                            <button
                                className="template-btn"
                                onClick={() => setCode(CODE_TEMPLATES.linkedlist)}
                            >
                                Linked List
                            </button>
                        </div>
                    </div>

                    <div className="editor-wrapper">
                        <Editor
                            height="100%"
                            language="cpp"
                            value={code}
                            theme={theme === "dark" ? "vs-dark" : "light"}
                            onChange={(value) => setCode(value || "")}
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                automaticLayout: true,
                                scrollBeyondLastLine: false,
                                wordWrap: "on",
                                lineNumbers: "on",
                                glyphMargin: true,
                                folding: true,
                            }}
                        />

                        {/* Current line highlight indicator */}
                        {currentState && currentState.currentLine && (
                            <div
                                className="line-indicator"
                                style={{ top: `${(currentState.currentLine - 1) * 19}px` }}
                            />
                        )}
                    </div>

                    <div className="run-section">
                        <button
                            className={`visualize-btn ${isLoading ? "loading" : ""}`}
                            onClick={handleStartVisualization}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <span className="icon">▶</span>
                                    Visualize
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Panel - Visualization */}
                <div className="visualization-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <span className="icon">📊</span>
                            Visualization
                        </div>
                        {sessionId && (
                            <div className="step-info">
                                Step {currentStep + 1} / {totalSteps}
                            </div>
                        )}
                    </div>

                    <div className="canvas-wrapper">
                        {error ? (
                            <div className="error-container">
                                <div className="error-box">
                                    <div className="error-type">{error.type}</div>
                                    <div className="error-message">{error.message}</div>
                                </div>
                            </div>
                        ) : currentState ? (
                            <VisualizationCanvas state={currentState} theme={theme} />
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">🎯</div>
                                <div className="empty-text">
                                    Click "Visualize" to see your code come to life
                                </div>
                                <div className="empty-hint">
                                    Use arrow keys to step through execution
                                </div>
                            </div>
                        )}
                    </div>

                    {sessionId && (
                        <PlaybackControls
                            onStepForward={handleStepForward}
                            onStepBackward={handleStepBackward}
                            currentStep={currentStep}
                            totalSteps={totalSteps}
                            theme={theme}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Visualizer;
