import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "../temp");

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * LLDB Service - Manages debug sessions for C++ code visualization
 * Uses static code analysis with simulated execution to capture variable states
 */
class LLDBService {
    constructor() {
        this.sessions = new Map();
    }

    /**
     * Start a new debug session
     */
    async startSession(code) {
        const sessionId = uuidv4();
        const sourceFile = path.join(tempDir, `${sessionId}.cpp`);
        const executableFile = path.join(tempDir, sessionId);

        try {
            fs.writeFileSync(sourceFile, code);

            // Compile to verify code is valid
            const compileResult = await this.compile(sourceFile, executableFile);
            if (!compileResult.success) {
                this.cleanupFiles([sourceFile]);
                return {
                    success: false,
                    error: "Compilation Error",
                    details: compileResult.error,
                };
            }

            // Simulate execution and generate states
            const states = this.simulateExecution(code);

            const session = {
                id: sessionId,
                code,
                states,
                currentStep: 0,
                createdAt: Date.now(),
            };

            this.sessions.set(sessionId, session);
            this.cleanupFiles([sourceFile, executableFile, `${executableFile}.dSYM`]);

            return {
                success: true,
                sessionId,
                totalSteps: states.length,
                initialState: states[0] || null,
            };
        } catch (error) {
            console.error("Debug session error:", error);
            this.cleanupFiles([sourceFile, executableFile, `${executableFile}.dSYM`]);
            return {
                success: false,
                error: "Debug Error",
                details: error.message,
            };
        }
    }

    /**
     * Compile C++ code
     */
    async compile(sourceFile, executableFile) {
        return new Promise((resolve) => {
            try {
                execSync(`clang++ -g -O0 -std=c++17 -o "${executableFile}" "${sourceFile}" 2>&1`, {
                    encoding: "utf-8",
                    timeout: 30000,
                });
                resolve({ success: true });
            } catch (error) {
                resolve({ success: false, error: error.stdout || error.message });
            }
        });
    }

    /**
     * Simulate code execution and generate visualization states
     * Uses two-pass approach: first collect variables before loops, then process loops
     */
    simulateExecution(code) {
        const lines = code.split("\n");
        const states = [];
        const variables = new Map(); // name -> variable object
        const heap = new Map(); // heapId -> heap object
        let stepCount = 0;
        let inMain = false;

        // First pass: collect all variable declarations BEFORE any loops
        // This allows us to resolve loop bounds like "i < n"
        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();

            // Skip preprocessor
            if (trimmedLine.startsWith("#") || !trimmedLine) continue;

            // Track main function
            if (trimmedLine.includes("int main") || trimmedLine.includes("void main")) {
                inMain = true;
                continue;
            }

            if (!inMain) continue;

            // Stop at first loop
            if (trimmedLine.startsWith("for") || trimmedLine.startsWith("while")) {
                break;
            }

            // Collect variable but don't add to states yet
            this.parseLineForVars(trimmedLine, variables, heap);
        }

        // Second pass: identify loops with resolved variable values
        const loopRanges = this.identifyLoops(lines, variables);

        // Reset for actual execution
        inMain = false;

        // Third pass: actually execute and generate states
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmedLine = line.trim();

            // Skip empty lines, preprocessor, comments
            if (!trimmedLine || trimmedLine.startsWith("#") || trimmedLine.startsWith("//")) {
                continue;
            }

            // Track main function
            if (trimmedLine.includes("int main") || trimmedLine.includes("void main")) {
                inMain = true;
                continue;
            }

            if (!inMain) continue;
            if (trimmedLine === "{" || trimmedLine === "}") continue;
            if (trimmedLine.startsWith("return")) continue;
            if (trimmedLine.startsWith("cout") || trimmedLine.startsWith("cin")) continue;

            // Check if this line is inside a loop
            const loopInfo = loopRanges.find(l => lineNum >= l.start && lineNum <= l.end);

            if (loopInfo && lineNum === loopInfo.start) {
                // Re-resolve loop bounds with current variable values
                if (loopInfo.endValStr && !/^\d+$/.test(loopInfo.endValStr)) {
                    const endVar = variables.get(loopInfo.endValStr);
                    if (endVar) {
                        loopInfo.endVal = endVar.value;
                        loopInfo.iterations = loopInfo.endVal - loopInfo.startVal;
                        loopInfo.iterations = Math.min(Math.max(loopInfo.iterations, 0), 50);
                    }
                }

                // Simulate loop iterations
                const loopStates = this.simulateLoop(loopInfo, lines, variables, heap, stepCount);
                states.push(...loopStates);
                stepCount += loopStates.length;
                i = loopInfo.end - 1; // Skip to end of loop
                continue;
            }

            // Skip if inside a loop (we handle those in simulateLoop)
            if (loopInfo) continue;

            // Parse the line
            const result = this.parseLine(trimmedLine, variables, heap);

            if (result.changed) {
                stepCount++;
                states.push(this.createState(stepCount - 1, lineNum, trimmedLine, variables, heap, result.action));
            }
        }

        // If no states, create default
        if (states.length === 0) {
            states.push(this.createState(0, 1, "Program start", variables, heap));
        }

        return states;
    }

    /**
     * Parse line for variables only (no state generation)
     * Used in first pass to collect vars before loop processing
     */
    parseLineForVars(line, variables, heap) {
        line = line.split("//")[0].trim();

        // Primitive declaration: int x = 10;
        const primitiveMatch = line.match(/^\s*(int|float|double|char|bool|long|short)\s+(\w+)\s*=\s*([^;]+)/);
        if (primitiveMatch) {
            const [, type, name, valueStr] = primitiveMatch;
            const value = this.evaluateExpression(valueStr, variables);
            variables.set(name, {
                id: `var_${name}`,
                name,
                type,
                value,
                visualType: "primitive",
            });
            return;
        }

        // Array declaration: int arr[5] = {1, 2, 3, 4, 5};
        const arrayDeclMatch = line.match(/^\s*(int|float|double|char)\s+(\w+)\s*\[\s*(\d*)\s*\]\s*=\s*\{([^}]+)\}/);
        if (arrayDeclMatch) {
            const [, type, name, , valuesStr] = arrayDeclMatch;
            const values = valuesStr.split(",").map(v => this.evaluateExpression(v.trim(), variables));
            variables.set(name, {
                id: `var_${name}`,
                name,
                type: `${type}[${values.length}]`,
                value: [...values],
                visualType: "array",
            });
            return;
        }
    }

    /**
     * Identify loop structures in code
     * Now handles both literal numbers and variable-based bounds
     */
    identifyLoops(lines, variables = new Map()) {
        const loops = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;

            // Detect for loops with flexible pattern
            // Matches: for (int i = 0; i < n; i++) or for (int i = 0; i < 10; i++)
            const forMatch = line.match(/for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*(\w+|\d+)\s*;\s*\w+\s*([<>=!]+)\s*(\w+|\d+)\s*;\s*\w+(\+\+|--|\+=\d+|-=\d+)/);
            const whileMatch = line.match(/while\s*\((.+)\)/);

            if (forMatch || whileMatch) {
                const loopStart = lineNum;
                let braceCount = 0;
                let loopEnd = lineNum;

                // Find matching closing brace
                for (let j = i; j < lines.length; j++) {
                    const l = lines[j];
                    braceCount += (l.match(/{/g) || []).length;
                    braceCount -= (l.match(/}/g) || []).length;
                    if (braceCount === 0 && j > i) {
                        loopEnd = j + 1;
                        break;
                    }
                }

                if (forMatch) {
                    const [, varName, startValStr, op, endValStr, increment] = forMatch;

                    // Resolve start value (could be number or variable)
                    let start;
                    if (/^\d+$/.test(startValStr)) {
                        start = parseInt(startValStr);
                    } else {
                        const startVar = variables.get(startValStr);
                        start = startVar ? startVar.value : 0;
                    }

                    // Resolve end value (could be number or variable)
                    let end;
                    if (/^\d+$/.test(endValStr)) {
                        end = parseInt(endValStr);
                    } else {
                        const endVar = variables.get(endValStr);
                        end = endVar ? endVar.value : 10; // Default to 10 if not found
                    }

                    // Calculate iterations based on operator
                    let iterations = 0;
                    if (op === "<") {
                        iterations = end - start;
                    } else if (op === "<=") {
                        iterations = end - start + 1;
                    } else if (op === ">") {
                        iterations = start - end;
                    } else if (op === ">=") {
                        iterations = start - end + 1;
                    } else if (op === "!=") {
                        iterations = Math.abs(end - start);
                    }

                    // Limit iterations for safety
                    iterations = Math.min(Math.max(iterations, 0), 50);

                    loops.push({
                        type: "for",
                        start: loopStart,
                        end: loopEnd,
                        varName,
                        startVal: start,
                        endVal: end,
                        endValStr, // Keep original string for later resolution
                        operator: op,
                        increment,
                        iterations,
                    });
                } else if (whileMatch) {
                    loops.push({
                        type: "while",
                        start: loopStart,
                        end: loopEnd,
                        condition: whileMatch[1],
                        iterations: 10, // Default limit for while loops
                    });
                }
            }
        }

        return loops;
    }

    /**
     * Simulate loop execution with proper if-statement handling
     */
    simulateLoop(loopInfo, lines, variables, heap, baseStep) {
        const states = [];
        const loopBodyStart = loopInfo.start;
        const loopBodyEnd = loopInfo.end;

        // Create loop variable if it's a for loop
        if (loopInfo.type === "for") {
            variables.set(loopInfo.varName, {
                id: `var_${loopInfo.varName}`,
                name: loopInfo.varName,
                type: "int",
                value: loopInfo.startVal,
                visualType: "primitive",
            });
        }

        for (let iter = 0; iter < loopInfo.iterations; iter++) {
            // Update loop counter for for-loops
            if (loopInfo.type === "for") {
                const loopVar = variables.get(loopInfo.varName);
                if (loopVar) {
                    loopVar.value = loopInfo.startVal + iter;
                }
            }

            // Collect loop body lines
            const bodyLines = [];
            for (let i = loopBodyStart; i < loopBodyEnd - 1; i++) {
                const line = lines[i].trim();
                if (!line || line === "{" || line === "}" || line.startsWith("for") || line.startsWith("while")) {
                    continue;
                }
                bodyLines.push({ lineNum: i + 1, content: line });
            }

            // Process loop body with if-statement awareness
            let skipUntilBrace = 0;
            let ifConditionMet = false;

            for (const { lineNum, content } of bodyLines) {
                let processedLine = content;

                // Substitute loop variable with actual value
                if (loopInfo.type === "for") {
                    const loopVar = variables.get(loopInfo.varName);
                    if (loopVar) {
                        // Replace arr[i] with arr[0], arr[1], etc.
                        processedLine = processedLine.replace(
                            new RegExp(`\\[\\s*${loopInfo.varName}\\s*\\]`, 'g'),
                            `[${loopVar.value}]`
                        );
                        // Replace standalone i with value
                        processedLine = processedLine.replace(
                            new RegExp(`\\b${loopInfo.varName}\\b`, 'g'),
                            `${loopVar.value}`
                        );
                    }
                }

                // Check for if statement
                const ifMatch = processedLine.match(/^if\s*\((.+)\)\s*\{?$/);
                if (ifMatch) {
                    const condition = ifMatch[1];
                    ifConditionMet = this.evaluateCondition(condition, variables);
                    if (!ifConditionMet) {
                        skipUntilBrace = 1; // Skip the if body
                    }
                    continue;
                }

                // Check for closing brace (end of if block)
                if (processedLine === "}" && skipUntilBrace > 0) {
                    skipUntilBrace--;
                    continue;
                }

                // Skip lines inside a false if block
                if (skipUntilBrace > 0) {
                    if (processedLine.includes("{")) skipUntilBrace++;
                    if (processedLine.includes("}")) skipUntilBrace--;
                    continue;
                }

                // Parse and execute the line
                const result = this.parseLine(processedLine, variables, heap);

                if (result.changed) {
                    const stepNum = baseStep + states.length;
                    const action = result.action || `Loop iteration ${iter + 1}`;
                    states.push(this.createState(stepNum, lineNum, content, variables, heap, action));
                }
            }
        }

        return states;
    }

    /**
     * Evaluate a condition expression (returns true/false)
     */
    evaluateCondition(condition, variables) {
        condition = condition.trim();

        // ========== MODULO CHECKS (must come first!) ==========
        // Pattern: expr % value == 0 (even/odd check)
        const modEqMatch = condition.match(/^(.+?)\s*%\s*(\d+)\s*==\s*(\d+)$/);
        if (modEqMatch) {
            const value = this.evaluateExpression(modEqMatch[1].trim(), variables);
            const divisor = parseInt(modEqMatch[2]);
            const remainder = parseInt(modEqMatch[3]);
            return value % divisor === remainder;
        }

        // Pattern: expr % value != 0
        const modNeqMatch = condition.match(/^(.+?)\s*%\s*(\d+)\s*!=\s*(\d+)$/);
        if (modNeqMatch) {
            const value = this.evaluateExpression(modNeqMatch[1].trim(), variables);
            const divisor = parseInt(modNeqMatch[2]);
            const remainder = parseInt(modNeqMatch[3]);
            return value % divisor !== remainder;
        }

        // ========== COMPARISON OPERATORS ==========
        // Pattern: expr == expr
        const eqMatch = condition.match(/^(.+?)\s*==\s*(.+)$/);
        if (eqMatch) {
            const left = this.evaluateExpression(eqMatch[1].trim(), variables);
            const right = this.evaluateExpression(eqMatch[2].trim(), variables);
            return left === right;
        }

        // Pattern: expr != expr
        const neqMatch = condition.match(/^(.+?)\s*!=\s*(.+)$/);
        if (neqMatch) {
            const left = this.evaluateExpression(neqMatch[1].trim(), variables);
            const right = this.evaluateExpression(neqMatch[2].trim(), variables);
            return left !== right;
        }

        // Pattern: expr <= expr (must come before <)
        const leMatch = condition.match(/^(.+?)\s*<=\s*(.+)$/);
        if (leMatch) {
            const left = this.evaluateExpression(leMatch[1].trim(), variables);
            const right = this.evaluateExpression(leMatch[2].trim(), variables);
            return left <= right;
        }

        // Pattern: expr >= expr (must come before >)
        const geMatch = condition.match(/^(.+?)\s*>=\s*(.+)$/);
        if (geMatch) {
            const left = this.evaluateExpression(geMatch[1].trim(), variables);
            const right = this.evaluateExpression(geMatch[2].trim(), variables);
            return left >= right;
        }

        // Pattern: expr < expr
        const ltMatch = condition.match(/^(.+?)\s*<\s*(.+)$/);
        if (ltMatch) {
            const left = this.evaluateExpression(ltMatch[1].trim(), variables);
            const right = this.evaluateExpression(ltMatch[2].trim(), variables);
            return left < right;
        }

        // Pattern: expr > expr
        const gtMatch = condition.match(/^(.+?)\s*>\s*(.+)$/);
        if (gtMatch) {
            const left = this.evaluateExpression(gtMatch[1].trim(), variables);
            const right = this.evaluateExpression(gtMatch[2].trim(), variables);
            return left > right;
        }

        // Just evaluate as truthy/falsy
        const val = this.evaluateExpression(condition, variables);
        return !!val;
    }

    /**
     * Parse a single line and update variables
     */
    parseLine(line, variables, heap) {
        let changed = false;
        let action = null;

        // Remove trailing comments and semicolons for parsing
        line = line.split("//")[0].trim();

        // ========== PRIMITIVE DECLARATIONS ==========
        // Pattern: int x = 10;
        const primitiveMatch = line.match(/^\s*(int|float|double|char|bool|long|short)\s+(\w+)\s*=\s*([^;]+)/);
        if (primitiveMatch) {
            const [, type, name, valueStr] = primitiveMatch;
            const value = this.evaluateExpression(valueStr, variables);
            variables.set(name, {
                id: `var_${name}`,
                name,
                type,
                value,
                visualType: "primitive",
            });
            action = `Created ${name} = ${value}`;
            return { changed: true, action };
        }

        // ========== ARRAY DECLARATION ==========
        // Pattern: int arr[5] = {1, 2, 3, 4, 5};
        const arrayDeclMatch = line.match(/^\s*(int|float|double|char)\s+(\w+)\s*\[\s*(\d*)\s*\]\s*=\s*\{([^}]+)\}/);
        if (arrayDeclMatch) {
            const [, type, name, , valuesStr] = arrayDeclMatch;
            const values = valuesStr.split(",").map(v => this.evaluateExpression(v.trim(), variables));
            variables.set(name, {
                id: `var_${name}`,
                name,
                type: `${type}[${values.length}]`,
                value: [...values],
                visualType: "array",
            });
            action = `Created array ${name}[${values.length}]`;
            return { changed: true, action };
        }

        // ========== ARRAY ELEMENT MODIFICATION ==========
        // Pattern: arr[0] = 10; or arr[i] = value;
        const arrayModMatch = line.match(/^\s*(\w+)\s*\[\s*(\d+)\s*\]\s*=\s*([^;]+)/);
        if (arrayModMatch) {
            const [, arrName, indexStr, valueStr] = arrayModMatch;
            const index = parseInt(indexStr);
            const value = this.evaluateExpression(valueStr, variables);

            if (variables.has(arrName)) {
                const arr = variables.get(arrName);
                if (Array.isArray(arr.value)) {
                    const oldValue = arr.value[index];
                    arr.value[index] = value;
                    action = `${arrName}[${index}] changed: ${oldValue} → ${value}`;
                    return { changed: true, action };
                }
            }
        }

        // ========== POINTER DECLARATION ==========
        // Pattern: Node* ptr = new Node(); or int* ptr = &x;
        const pointerDeclMatch = line.match(/^\s*(\w+)\s*\*\s*(\w+)\s*=\s*(new\s+(\w+)|nullptr|NULL|&(\w+))/);
        if (pointerDeclMatch) {
            const [, type, name, valueExpr, newType, refVar] = pointerDeclMatch;

            if (valueExpr.includes("new")) {
                // Create heap object
                const heapId = `heap_${name}_${Date.now()}`;
                heap.set(heapId, {
                    id: heapId,
                    type: newType || type,
                    address: heapId,
                    fields: [],
                });

                variables.set(name, {
                    id: `var_${name}`,
                    name,
                    type: `${type}*`,
                    value: heapId,
                    visualType: "pointer",
                    pointsTo: heapId,
                });
                action = `Created pointer ${name} → new ${newType || type}`;
            } else if (refVar) {
                variables.set(name, {
                    id: `var_${name}`,
                    name,
                    type: `${type}*`,
                    value: `&${refVar}`,
                    visualType: "pointer",
                    pointsTo: `var_${refVar}`,
                });
                action = `Created pointer ${name} → ${refVar}`;
            } else {
                variables.set(name, {
                    id: `var_${name}`,
                    name,
                    type: `${type}*`,
                    value: "nullptr",
                    visualType: "pointer",
                    pointsTo: null,
                });
                action = `Created pointer ${name} = nullptr`;
            }
            return { changed: true, action };
        }

        // ========== STRUCT MEMBER ASSIGNMENT ==========
        // Pattern: ptr->data = 10; or node->next = other;
        const memberAssignMatch = line.match(/^\s*(\w+)->(\w+)\s*=\s*([^;]+)/);
        if (memberAssignMatch) {
            const [, ptrName, fieldName, valueStr] = memberAssignMatch;
            const ptr = variables.get(ptrName);

            if (ptr && ptr.pointsTo) {
                const heapObj = heap.get(ptr.pointsTo);
                if (heapObj) {
                    const value = this.evaluateExpression(valueStr, variables);

                    // Check if this is a pointer field (like next)
                    const isPointerField = fieldName === "next" || fieldName === "prev" || valueStr.includes("nullptr") || valueStr.includes("NULL");

                    // Find or create field
                    let field = heapObj.fields.find(f => f.name === fieldName);
                    if (field) {
                        const oldValue = field.value;
                        field.value = value;
                        action = `${ptrName}->${fieldName} changed: ${oldValue} → ${value}`;
                    } else {
                        heapObj.fields.push({
                            name: fieldName,
                            value: value,
                            visualType: isPointerField ? "pointer" : "primitive",
                        });
                        action = `Set ${ptrName}->${fieldName} = ${value}`;
                    }
                    return { changed: true, action };
                }
            }
        }

        // ========== POINTER REASSIGNMENT ==========
        // Pattern: ptr = ptr->next; or head = newNode;
        const ptrReassignMatch = line.match(/^\s*(\w+)\s*=\s*(\w+)->(\w+)\s*;?/);
        if (ptrReassignMatch) {
            const [, targetName, sourceName, fieldName] = ptrReassignMatch;
            const sourcePtr = variables.get(sourceName);

            if (sourcePtr && sourcePtr.pointsTo) {
                const heapObj = heap.get(sourcePtr.pointsTo);
                if (heapObj) {
                    const field = heapObj.fields.find(f => f.name === fieldName);
                    if (field) {
                        const targetPtr = variables.get(targetName);
                        if (targetPtr) {
                            const oldValue = targetPtr.pointsTo;
                            targetPtr.pointsTo = field.value;
                            targetPtr.value = field.value;
                            action = `${targetName} moved: now points to ${field.value || 'nullptr'}`;
                            return { changed: true, action };
                        }
                    }
                }
            }
        }

        // ========== VARIABLE REASSIGNMENT ==========
        // Pattern: x = 20; or x = y + 5;
        const reassignMatch = line.match(/^\s*(\w+)\s*=\s*([^;]+);?$/);
        if (reassignMatch && !primitiveMatch && !arrayModMatch && !memberAssignMatch && !ptrReassignMatch) {
            const [, name, valueStr] = reassignMatch;

            if (variables.has(name)) {
                const variable = variables.get(name);
                const oldValue = variable.value;
                const newValue = this.evaluateExpression(valueStr, variables);
                variable.value = newValue;
                action = `${name} changed: ${oldValue} → ${newValue}`;
                return { changed: true, action };
            }
        }

        // ========== INCREMENT/DECREMENT ==========
        // Pattern: x++; or ++x; or x--; or --x;
        const incrDecrMatch = line.match(/^\s*(\+\+|--)?(\w+)(\+\+|--)?\s*;?$/);
        if (incrDecrMatch) {
            const [, prefix, name, suffix] = incrDecrMatch;
            if ((prefix || suffix) && variables.has(name)) {
                const variable = variables.get(name);
                const oldValue = variable.value;
                if (prefix === "++" || suffix === "++") {
                    variable.value++;
                    action = `${name} incremented: ${oldValue} → ${variable.value}`;
                } else if (prefix === "--" || suffix === "--") {
                    variable.value--;
                    action = `${name} decremented: ${oldValue} → ${variable.value}`;
                }
                return { changed: true, action };
            }
        }

        // ========== COMPOUND ASSIGNMENT ==========
        // Pattern: x += 5; x -= 3; x *= 2; x /= 2;
        const compoundMatch = line.match(/^\s*(\w+)\s*([+\-*/])=\s*([^;]+);?$/);
        if (compoundMatch) {
            const [, name, op, valueStr] = compoundMatch;
            if (variables.has(name)) {
                const variable = variables.get(name);
                const oldValue = variable.value;
                const operand = this.evaluateExpression(valueStr, variables);

                switch (op) {
                    case "+": variable.value += operand; break;
                    case "-": variable.value -= operand; break;
                    case "*": variable.value *= operand; break;
                    case "/": variable.value = operand !== 0 ? Math.floor(variable.value / operand) : 0; break;
                }
                action = `${name} ${op}= ${operand}: ${oldValue} → ${variable.value}`;
                return { changed: true, action };
            }
        }

        // ========== SWAP OPERATIONS ==========
        // Pattern: swap(arr[i], arr[j]);
        const swapMatch = line.match(/swap\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/);
        if (swapMatch) {
            const [, arr1Name, idx1Str, arr2Name, idx2Str] = swapMatch;
            const idx1 = parseInt(idx1Str);
            const idx2 = parseInt(idx2Str);

            if (variables.has(arr1Name)) {
                const arr = variables.get(arr1Name);
                if (Array.isArray(arr.value)) {
                    const temp = arr.value[idx1];
                    arr.value[idx1] = arr.value[idx2];
                    arr.value[idx2] = temp;
                    action = `Swapped ${arr1Name}[${idx1}] ↔ ${arr1Name}[${idx2}]`;
                    return { changed: true, action };
                }
            }
        }

        return { changed, action };
    }

    /**
     * Evaluate an expression with variable substitution
     * Handles sizeof, arithmetic, function calls, etc.
     */
    evaluateExpression(expr, variables) {
        if (!expr) return 0;
        expr = expr.trim().replace(/;$/, "");

        // Handle nullptr/NULL
        if (expr === "nullptr" || expr === "NULL") return "nullptr";

        // Handle simple numbers (int or float)
        if (/^-?\d+(\.\d+)?$/.test(expr)) {
            return parseFloat(expr);
        }

        // Handle hexadecimal numbers
        if (/^0x[0-9a-fA-F]+$/.test(expr)) {
            return parseInt(expr, 16);
        }

        // Handle character literals
        const charMatch = expr.match(/^'(.)'$/);
        if (charMatch) return charMatch[1];

        // Handle string literals
        if (expr.startsWith('"') && expr.endsWith('"')) {
            return expr.slice(1, -1);
        }

        // Handle bool literals
        if (expr === "true") return true;
        if (expr === "false") return false;

        // ========== SIZEOF EXPRESSIONS ==========
        // Pattern: sizeof(arr) / sizeof(arr[0])
        const sizeofDivMatch = expr.match(/sizeof\s*\(\s*(\w+)\s*\)\s*\/\s*sizeof\s*\(\s*(\w+)\s*\[\s*\d*\s*\]\s*\)/);
        if (sizeofDivMatch) {
            const [, arrName] = sizeofDivMatch;
            const arr = variables.get(arrName);
            if (arr && Array.isArray(arr.value)) {
                return arr.value.length;
            }
            return 0;
        }

        // Pattern: sizeof(arr)
        const sizeofArrMatch = expr.match(/^sizeof\s*\(\s*(\w+)\s*\)$/);
        if (sizeofArrMatch) {
            const [, name] = sizeofArrMatch;
            const variable = variables.get(name);
            if (variable) {
                if (Array.isArray(variable.value)) {
                    // Assume int = 4 bytes
                    return variable.value.length * 4;
                }
                // Single variable
                return 4;
            }
            return 4; // Default size
        }

        // Pattern: sizeof(type) like sizeof(int)
        const sizeofTypeMatch = expr.match(/^sizeof\s*\(\s*(int|float|double|char|long|short|bool)\s*\)$/);
        if (sizeofTypeMatch) {
            const [, type] = sizeofTypeMatch;
            const sizes = {
                char: 1, bool: 1, short: 2, int: 4, float: 4, long: 8, double: 8
            };
            return sizes[type] || 4;
        }

        // ========== SIMPLE VARIABLE REFERENCE ==========
        if (/^\w+$/.test(expr)) {
            const variable = variables.get(expr);
            if (variable !== undefined) {
                return variable.value;
            }
            // Unknown variable - return 0 instead of string
            return 0;
        }

        // ========== ARRAY ACCESS: arr[0] or arr[i] ==========
        const arrAccessMatch = expr.match(/^(\w+)\[\s*(\w+|\d+)\s*\]$/);
        if (arrAccessMatch) {
            const [, arrName, indexExpr] = arrAccessMatch;
            const arr = variables.get(arrName);
            if (arr && Array.isArray(arr.value)) {
                // Index could be a number or variable
                let index;
                if (/^\d+$/.test(indexExpr)) {
                    index = parseInt(indexExpr);
                } else {
                    const indexVar = variables.get(indexExpr);
                    index = indexVar ? indexVar.value : 0;
                }
                if (index >= 0 && index < arr.value.length) {
                    return arr.value[index];
                }
            }
            return 0;
        }

        // ========== PARENTHESIZED EXPRESSIONS ==========
        // Handle (expr) by recursively evaluating
        if (expr.startsWith("(") && expr.endsWith(")")) {
            // Check if the entire expression is wrapped in matching parens
            let depth = 0;
            let isWrapped = true;
            for (let i = 0; i < expr.length - 1; i++) {
                if (expr[i] === "(") depth++;
                else if (expr[i] === ")") depth--;
                if (depth === 0 && i < expr.length - 1) {
                    isWrapped = false;
                    break;
                }
            }
            if (isWrapped) {
                return this.evaluateExpression(expr.slice(1, -1), variables);
            }
        }

        // ========== COMPLEX ARITHMETIC ==========
        // Handle expressions with operators: +, -, *, /, %
        // First, try to parse and evaluate
        const result = this.evaluateArithmetic(expr, variables);
        if (result !== null) {
            return result;
        }

        // ========== FUNCTION CALLS ==========
        // Pattern: functionName(args) - try to evaluate common functions
        const funcMatch = expr.match(/^(\w+)\s*\(([^)]*)\)$/);
        if (funcMatch) {
            const [, funcName, argsStr] = funcMatch;
            const args = argsStr.split(",").map(a => this.evaluateExpression(a.trim(), variables));

            // Handle common functions
            switch (funcName) {
                case "abs": return Math.abs(args[0]);
                case "min": return Math.min(...args);
                case "max": return Math.max(...args);
                case "sqrt": return Math.sqrt(args[0]);
                case "pow": return Math.pow(args[0], args[1] || 2);
                default:
                    // Unknown function, return the computed first arg or 0
                    return args[0] || 0;
            }
        }

        // ========== TERNARY OPERATOR ==========
        // Pattern: condition ? trueVal : falseVal
        const ternaryMatch = expr.match(/^(.+)\s*\?\s*(.+)\s*:\s*(.+)$/);
        if (ternaryMatch) {
            const [, condExpr, trueExpr, falseExpr] = ternaryMatch;
            const condition = this.evaluateExpression(condExpr, variables);
            return condition ?
                this.evaluateExpression(trueExpr, variables) :
                this.evaluateExpression(falseExpr, variables);
        }

        // ========== POINTER/ADDRESS OPERATIONS ==========
        if (expr.startsWith("&")) {
            const varName = expr.slice(1);
            if (variables.has(varName)) {
                return `&${varName}`;
            }
        }

        if (expr.startsWith("*")) {
            const varName = expr.slice(1);
            const ptrVar = variables.get(varName);
            if (ptrVar && ptrVar.pointsTo) {
                return ptrVar.pointsTo;
            }
        }

        // If we can't evaluate, return 0 instead of string for numeric contexts
        // Check if it looks like a numeric expression
        if (/^[\w\d\s+\-*/().]+$/.test(expr)) {
            return 0;
        }

        // Otherwise return the expression as string (for non-numeric types)
        return expr;
    }

    /**
     * Evaluate arithmetic expressions with proper operator precedence
     */
    evaluateArithmetic(expr, variables) {
        // Tokenize the expression
        const tokens = this.tokenize(expr);
        if (tokens.length === 0) return null;

        try {
            return this.parseAddSub(tokens, variables);
        } catch (e) {
            return null;
        }
    }

    /**
     * Tokenize an expression into numbers, operators, and identifiers
     */
    tokenize(expr) {
        const tokens = [];
        let i = 0;

        while (i < expr.length) {
            const char = expr[i];

            // Skip whitespace
            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // Operators
            if (["+", "-", "*", "/", "%", "(", ")"].includes(char)) {
                tokens.push({ type: "op", value: char });
                i++;
                continue;
            }

            // Numbers
            if (/\d/.test(char)) {
                let num = "";
                while (i < expr.length && /[\d.]/.test(expr[i])) {
                    num += expr[i];
                    i++;
                }
                tokens.push({ type: "num", value: parseFloat(num) });
                continue;
            }

            // Identifiers (variables or function names)
            if (/[a-zA-Z_]/.test(char)) {
                let ident = "";
                while (i < expr.length && /[\w]/.test(expr[i])) {
                    ident += expr[i];
                    i++;
                }
                tokens.push({ type: "id", value: ident });
                continue;
            }

            // Unknown character, skip
            i++;
        }

        return tokens;
    }

    /**
     * Parse addition and subtraction (lowest precedence)
     */
    parseAddSub(tokens, variables) {
        let left = this.parseMulDiv(tokens, variables);

        while (tokens.length > 0 && (tokens[0].value === "+" || tokens[0].value === "-")) {
            const op = tokens.shift().value;
            const right = this.parseMulDiv(tokens, variables);

            if (op === "+") left = left + right;
            else left = left - right;
        }

        return left;
    }

    /**
     * Parse multiplication, division, modulo (higher precedence)
     */
    parseMulDiv(tokens, variables) {
        let left = this.parsePrimary(tokens, variables);

        while (tokens.length > 0 && (tokens[0].value === "*" || tokens[0].value === "/" || tokens[0].value === "%")) {
            const op = tokens.shift().value;
            const right = this.parsePrimary(tokens, variables);

            if (op === "*") left = left * right;
            else if (op === "/") left = right !== 0 ? Math.floor(left / right) : 0;
            else left = right !== 0 ? left % right : 0;
        }

        return left;
    }

    /**
     * Parse primary values: numbers, variables, parentheses
     */
    parsePrimary(tokens, variables) {
        if (tokens.length === 0) return 0;

        const token = tokens.shift();

        // Handle negative numbers
        if (token.value === "-") {
            return -this.parsePrimary(tokens, variables);
        }

        // Handle positive sign
        if (token.value === "+") {
            return this.parsePrimary(tokens, variables);
        }

        // Handle parentheses
        if (token.value === "(") {
            const result = this.parseAddSub(tokens, variables);
            // Consume closing paren
            if (tokens.length > 0 && tokens[0].value === ")") {
                tokens.shift();
            }
            return result;
        }

        // Handle numbers
        if (token.type === "num") {
            return token.value;
        }

        // Handle identifiers (variables)
        if (token.type === "id") {
            const variable = variables.get(token.value);
            if (variable !== undefined) {
                if (typeof variable.value === "number") {
                    return variable.value;
                }
                return 0;
            }
            return 0;
        }

        return 0;
    }

    /**
     * Create a state snapshot
     */
    createState(step, line, sourceCode, variables, heap, action = null) {
        const varArray = Array.from(variables.values()).map(v => ({
            ...v,
            value: Array.isArray(v.value) ? [...v.value] : v.value,
        }));

        const heapArray = Array.from(heap.values()).map(h => ({
            ...h,
            fields: h.fields.map(f => ({ ...f })),
        }));

        return {
            step,
            currentLine: line,
            sourceCode,
            action,
            variables: varArray,
            stackFrames: [{
                id: `frame_${step}`,
                functionName: "main",
                line,
                variables: varArray,
            }],
            heap: heapArray,
        };
    }

    /**
     * Get state at step
     */
    getState(sessionId, step) {
        const session = this.sessions.get(sessionId);
        if (!session) return { success: false, error: "Session not found" };
        if (step < 0 || step >= session.states.length) return { success: false, error: "Invalid step" };
        return {
            success: true,
            state: session.states[step],
            step,
            totalSteps: session.states.length,
        };
    }

    /**
     * Step forward
     */
    stepForward(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return { success: false, error: "Session not found" };

        if (session.currentStep >= session.states.length - 1) {
            return {
                success: true,
                state: session.states[session.currentStep],
                step: session.currentStep,
                totalSteps: session.states.length,
                atEnd: true,
            };
        }

        session.currentStep++;
        return {
            success: true,
            state: session.states[session.currentStep],
            step: session.currentStep,
            totalSteps: session.states.length,
            atEnd: session.currentStep >= session.states.length - 1,
        };
    }

    /**
     * Step backward
     */
    stepBackward(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return { success: false, error: "Session not found" };

        if (session.currentStep <= 0) {
            return {
                success: true,
                state: session.states[0],
                step: 0,
                totalSteps: session.states.length,
                atStart: true,
            };
        }

        session.currentStep--;
        return {
            success: true,
            state: session.states[session.currentStep],
            step: session.currentStep,
            totalSteps: session.states.length,
            atStart: session.currentStep <= 0,
        };
    }

    /**
     * End session
     */
    endSession(sessionId) {
        if (!this.sessions.has(sessionId)) return { success: false, error: "Session not found" };
        this.sessions.delete(sessionId);
        return { success: true };
    }

    /**
     * Cleanup files
     */
    cleanupFiles(files) {
        files.forEach((file) => {
            try {
                if (fs.existsSync(file)) {
                    const stat = fs.statSync(file);
                    if (stat.isDirectory()) {
                        fs.rmSync(file, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(file);
                    }
                }
            } catch (err) { /* ignore */ }
        });
    }
}

export default new LLDBService();
