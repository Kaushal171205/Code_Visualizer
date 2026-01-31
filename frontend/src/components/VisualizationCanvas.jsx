import PrimitiveBox from "./boxes/PrimitiveBox";
import ArrayBox from "./boxes/ArrayBox";
import StructBox from "./boxes/StructBox";
import PointerArrow from "./boxes/PointerArrow";

/**
 * VisualizationCanvas - Renders the current state as boxes and arrows
 */
const VisualizationCanvas = ({ state, theme }) => {
    if (!state || !state.variables) {
        return (
            <div className="visualization-empty">
                <p>No data to visualize</p>
            </div>
        );
    }

    const variables = state.variables || [];
    const stackFrames = state.stackFrames || [];

    // Group variables by type for layout
    const primitives = variables.filter((v) => v.visualType === "primitive");
    const arrays = variables.filter((v) => v.visualType === "array");
    const structs = variables.filter((v) => v.visualType === "struct");
    const pointers = variables.filter((v) => v.visualType === "pointer");

    return (
        <div className={`visualization-canvas ${theme}`}>
            {/* Current Line Info */}
            {state.currentLine && (
                <div className="current-line-info">
                    <span className="line-badge">Line {state.currentLine}</span>
                    <code className="source-code">{state.sourceCode}</code>
                </div>
            )}

            {/* Action/Change Info */}
            {state.action && (
                <div className="action-info">
                    <span className="action-icon">⚡</span>
                    <span className="action-text">{state.action}</span>
                </div>
            )}

            {/* Stack Frame */}
            <div className="stack-section">
                <div className="section-label">Stack</div>

                {stackFrames.map((frame, idx) => (
                    <div key={frame.id || idx} className="stack-frame">
                        <div className="frame-header">
                            <span className="frame-name">{frame.functionName}()</span>
                            <span className="frame-line">line {frame.line}</span>
                        </div>
                        <div className="frame-variables">
                            {/* Primitives */}
                            {primitives.map((variable) => (
                                <PrimitiveBox
                                    key={variable.id}
                                    variable={variable}
                                    theme={theme}
                                />
                            ))}

                            {/* Arrays */}
                            {arrays.map((variable) => (
                                <ArrayBox key={variable.id} variable={variable} theme={theme} />
                            ))}

                            {/* Pointers */}
                            {pointers.map((variable) => (
                                <div key={variable.id} className="pointer-container">
                                    <PrimitiveBox
                                        variable={{
                                            ...variable,
                                            displayValue: variable.value,
                                            isPointer: true,
                                        }}
                                        theme={theme}
                                    />
                                    {variable.pointsTo && (
                                        <PointerArrow
                                            fromId={variable.id}
                                            toId={variable.pointsTo}
                                            theme={theme}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Heap Section (for dynamically allocated data) */}
            {state.heap && state.heap.length > 0 && (
                <div className="heap-section">
                    <div className="section-label">Heap</div>
                    <div className="heap-objects">
                        {state.heap.map((obj) => (
                            <StructBox key={obj.id} object={obj} theme={theme} />
                        ))}
                    </div>
                </div>
            )}

            {/* Structs/Nodes */}
            {structs.length > 0 && (
                <div className="struct-section">
                    {structs.map((variable) => (
                        <StructBox key={variable.id} object={variable} theme={theme} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default VisualizationCanvas;
