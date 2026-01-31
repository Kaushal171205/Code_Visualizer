/**
 * StructBox - Two-part box for structs/nodes (like linked list nodes)
 *
 * Visual style matches reference image:
 * ┌─────────┬─────────┐
 * │    A    │   ●──→  │
 * └─────────┴─────────┘
 *    Data      Next
 */
const StructBox = ({ object, theme }) => {
    const { name, type, value, fields } = object;

    // Fields can come from 'value' (array format) or 'fields' directly
    const fieldList = fields || value || [];

    // Check if this is a linked list node (has 'data' and 'next' fields)
    const isNode =
        fieldList.length === 2 &&
        fieldList.some((f) => f.name === "data" || f.name === "val") &&
        fieldList.some((f) => f.name === "next");

    if (isNode) {
        const dataField = fieldList.find(
            (f) => f.name === "data" || f.name === "val"
        );
        const nextField = fieldList.find((f) => f.name === "next");
        const isNull =
            nextField?.value === "nullptr" ||
            nextField?.value === "0x0" ||
            nextField?.value === "NULL" ||
            nextField?.pointsTo === null;

        return (
            <div className={`node-box ${theme}`}>
                {name && (
                    <div className="node-label">
                        <span className="var-name">{name}</span>
                    </div>
                )}
                <div className="node-container">
                    <div className="node-data">
                        <div className="data-value">{String(dataField?.value || "?")}</div>
                    </div>
                    <div className={`node-next ${isNull ? "null" : ""}`}>
                        {isNull ? (
                            <span className="null-indicator">╳</span>
                        ) : (
                            <span className="pointer-dot">●</span>
                        )}
                    </div>
                </div>
                <div className="node-field-labels">
                    <span>Data</span>
                    <span>Next</span>
                </div>
            </div>
        );
    }

    // Generic struct rendering
    return (
        <div className={`struct-box ${theme}`}>
            <div className="struct-header">
                <span className="struct-type">{type || name || "struct"}</span>
            </div>
            <div className="struct-fields">
                {fieldList.map((field, index) => (
                    <div key={index} className="struct-field">
                        <span className="field-name">{field.name}:</span>
                        <span className="field-value">{String(field.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StructBox;
