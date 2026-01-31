import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory for code files
const tempDir = path.join(__dirname, "../temp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Language configurations
const languageConfigs = {
    cpp: {
        extension: ".cpp",
        compile: (filePath, outputPath) => `g++ "${filePath}" -o "${outputPath}"`,
        run: (outputPath) => `"${outputPath}"`,
        needsCompilation: true,
    },
    c: {
        extension: ".c",
        compile: (filePath, outputPath) => `gcc "${filePath}" -o "${outputPath}"`,
        run: (outputPath) => `"${outputPath}"`,
        needsCompilation: true,
    },
    java: {
        extension: ".java",
        compile: (filePath, className, dir) => `javac "${filePath}"`,
        run: (className, dir) => `java -cp "${dir}" ${className}`,
        needsCompilation: true,
    },
    python: {
        extension: ".py",
        run: (filePath) => `python3 "${filePath}"`,
        needsCompilation: false,
    },
    javascript: {
        extension: ".js",
        run: (filePath) => `node "${filePath}"`,
        needsCompilation: false,
    },
};

// Execute a shell command with timeout
const executeCommand = (command, input = "", timeout = 10000) => {
    return new Promise((resolve, reject) => {
        const process = exec(
            command,
            { timeout, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    // Check if it's a timeout error
                    if (error.killed) {
                        reject({ error: "Execution timed out (10s limit)", stderr: "" });
                    } else {
                        reject({ error: error.message, stderr });
                    }
                } else {
                    resolve({ stdout, stderr });
                }
            }
        );

        // Send input if provided
        if (input && process.stdin) {
            process.stdin.write(input);
            process.stdin.end();
        }
    });
};

// Clean up temporary files
const cleanupFiles = (files) => {
    files.forEach((file) => {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        } catch (err) {
            console.error(`Failed to delete ${file}:`, err);
        }
    });
};

// Main execute controller
const executeController = async (req, res) => {
    const { code, language, input = "" } = req.body;

    // Validate request
    if (!code || !language) {
        return res.status(400).json({
            success: false,
            error: "Code and language are required",
        });
    }

    const config = languageConfigs[language.toLowerCase()];
    if (!config) {
        return res.status(400).json({
            success: false,
            error: `Unsupported language: ${language}. Supported: ${Object.keys(languageConfigs).join(", ")}`,
        });
    }

    const fileId = uuidv4();
    const filesToCleanup = [];

    try {
        let filePath, outputPath, className;

        // Handle Java's special class naming requirement
        if (language.toLowerCase() === "java") {
            // Extract class name from code
            const classMatch = code.match(/public\s+class\s+(\w+)/);
            className = classMatch ? classMatch[1] : "Main";
            filePath = path.join(tempDir, `${className}${config.extension}`);
        } else {
            filePath = path.join(tempDir, `${fileId}${config.extension}`);
        }

        // Write code to file
        fs.writeFileSync(filePath, code);
        filesToCleanup.push(filePath);

        let output = "";
        let compilationOutput = "";

        // Compile if needed
        if (config.needsCompilation) {
            if (language.toLowerCase() === "java") {
                const compileCommand = config.compile(filePath, className, tempDir);
                try {
                    const compileResult = await executeCommand(compileCommand, "", 30000);
                    compilationOutput = compileResult.stderr || "";
                    filesToCleanup.push(path.join(tempDir, `${className}.class`));
                } catch (compileError) {
                    return res.status(200).json({
                        success: false,
                        error: "Compilation Error",
                        output: compileError.stderr || compileError.error,
                    });
                }
            } else {
                // C/C++
                outputPath = path.join(tempDir, fileId);
                const compileCommand = config.compile(filePath, outputPath);
                try {
                    const compileResult = await executeCommand(compileCommand, "", 30000);
                    compilationOutput = compileResult.stderr || "";
                    filesToCleanup.push(outputPath);
                } catch (compileError) {
                    return res.status(200).json({
                        success: false,
                        error: "Compilation Error",
                        output: compileError.stderr || compileError.error,
                    });
                }
            }
        }

        // Run the code
        let runCommand;
        if (language.toLowerCase() === "java") {
            runCommand = config.run(className, tempDir);
        } else if (config.needsCompilation) {
            runCommand = config.run(outputPath);
        } else {
            runCommand = config.run(filePath);
        }

        try {
            const runResult = await executeCommand(runCommand, input, 10000);
            output = runResult.stdout;

            return res.status(200).json({
                success: true,
                output: output,
                stderr: runResult.stderr || "",
                compilationOutput,
            });
        } catch (runError) {
            return res.status(200).json({
                success: false,
                error: "Runtime Error",
                output: runError.stderr || runError.error,
            });
        }
    } catch (error) {
        console.error("Execution error:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
            output: error.message,
        });
    } finally {
        // Clean up temporary files
        cleanupFiles(filesToCleanup);
    }
};

export default executeController;
