import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

const CODE_TEMPLATES = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`,
  python: `print("Hello, World!")
`,
  javascript: `console.log("Hello, World!");
`,
  c: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`,
};
const API_URL = import.meta.env.VITE_API_URL || "";

const CodeEditor = ({ theme, language, code, setCode }) => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null); // 'success', 'error', null

  useEffect(() => {
    // Set template code when language changes
    if (CODE_TEMPLATES[language]) {
      setCode(CODE_TEMPLATES[language]);
    }
    setInput("");
    setOutput("");
    setExecutionStatus(null);
  }, [language, setCode]);

  const handleRunCode = async () => {
    setIsLoading(true);
    setOutput("");
    setExecutionStatus(null);

    try {
      const response = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          code,
          input,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setExecutionStatus("success");
        let result = data.output || "";
        if (data.stderr) {
          result += `\n[stderr]: ${data.stderr}`;
        }
        setOutput(result || "Program executed successfully with no output.");
      } else {
        setExecutionStatus("error");
        let errorOutput = "";
        if (data.error) {
          errorOutput = `❌ ${data.error}\n\n`;
        }
        if (data.output) {
          errorOutput += data.output;
        }
        setOutput(errorOutput || "An unknown error occurred.");
      }
    } catch (error) {
      setExecutionStatus("error");
      if (error.message.includes("Failed to fetch")) {
        setOutput(
          "❌ Connection Error\n\nCannot connect to the server. Please make sure the backend server is running on http://localhost:5001"
        );
      } else {
        setOutput(`❌ Error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get status-based styling for output panel
  const getOutputStyles = () => {
    const baseStyles = {
      background: theme === "dark" ? "#0f172a" : "#f8fafc",
      color: theme === "dark" ? "#e5e7eb" : "#020617",
      padding: "16px",
      borderRadius: "12px",
      minHeight: "140px",
      fontFamily: "'Fira Code', 'Consolas', monospace",
      whiteSpace: "pre-wrap",
      border: "1px solid",
      transition: "all 0.3s ease",
    };

    if (executionStatus === "success") {
      return {
        ...baseStyles,
        borderColor: theme === "dark" ? "#22c55e50" : "#22c55e40",
        boxShadow: theme === "dark" ? "0 0 20px #22c55e15" : "0 0 20px #22c55e10",
      };
    } else if (executionStatus === "error") {
      return {
        ...baseStyles,
        borderColor: theme === "dark" ? "#ef444450" : "#ef444440",
        boxShadow: theme === "dark" ? "0 0 20px #ef444415" : "0 0 20px #ef444410",
      };
    }
    return {
      ...baseStyles,
      borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
    };
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Editor Wrapper */}
      <div
        style={{
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow:
            theme === "dark"
              ? "0 4px 24px rgba(0,0,0,0.4)"
              : "0 4px 24px rgba(0,0,0,0.1)",
          border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            background: theme === "dark" ? "#1e293b" : "#f1f5f9",
            borderBottom: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#ef4444",
              }}
            />
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#f59e0b",
              }}
            />
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span
              style={{
                marginLeft: "12px",
                fontSize: "13px",
                color: theme === "dark" ? "#94a3b8" : "#64748b",
                fontWeight: "500",
              }}
            >
              {language.toUpperCase()}
            </span>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunCode}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 20px",
              background: isLoading
                ? "#4b5563"
                : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              boxShadow: isLoading ? "none" : "0 2px 8px rgba(34, 197, 94, 0.4)",
              transition: "all 0.2s ease",
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid #ffffff40",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Running...
              </>
            ) : (
              <>▶ Run Code</>
            )}
          </button>
        </div>

        {/* Code Editor */}
        <Editor
          height="50vh"
          width="100%"
          language={language === "cpp" ? "cpp" : language === "c" ? "c" : language}
          value={code}
          theme={theme === "dark" ? "vs-dark" : "light"}
          onChange={(value) => setCode(value || "")}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 16 },
            fontFamily: "'Fira Code', 'Consolas', monospace",
            fontLigatures: true,
            lineNumbers: "on",
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />
      </div>

      {/* Input & Output Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        {/* Test Case Input */}
        <div>
          <h4
            style={{
              marginBottom: "10px",
              fontSize: "14px",
              fontWeight: "600",
              color: theme === "dark" ? "#e5e7eb" : "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>📥</span> Input (stdin)
          </h4>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your input here..."
            style={{
              width: "100%",
              minHeight: "140px",
              padding: "14px",
              fontFamily: "'Fira Code', 'Consolas', monospace",
              fontSize: "13px",
              borderRadius: "12px",
              border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
              background: theme === "dark" ? "#0f172a" : "#ffffff",
              color: theme === "dark" ? "#e5e7eb" : "#020617",
              resize: "vertical",
              outline: "none",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
              e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme === "dark" ? "#334155" : "#e2e8f0";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Output Panel */}
        <div>
          <h4
            style={{
              marginBottom: "10px",
              fontSize: "14px",
              fontWeight: "600",
              color: theme === "dark" ? "#e5e7eb" : "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>📤</span> Output
            {executionStatus === "success" && (
              <span
                style={{
                  background: "#22c55e20",
                  color: "#22c55e",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                SUCCESS
              </span>
            )}
            {executionStatus === "error" && (
              <span
                style={{
                  background: "#ef444420",
                  color: "#ef4444",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                ERROR
              </span>
            )}
          </h4>
          <div style={getOutputStyles()}>
            {isLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: theme === "dark" ? "#94a3b8" : "#64748b",
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Executing your code...
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: "13px",
                  lineHeight: "1.6",
                }}
              >
                {output || (
                  <span style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}>
                    Click "▶ Run Code" to execute your program
                  </span>
                )}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default CodeEditor;
