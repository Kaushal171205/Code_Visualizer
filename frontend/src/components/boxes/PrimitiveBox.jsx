/**
 * PrimitiveBox - Single value box for int, char, float, etc.
 * 
 * Visual style: Dark gray box with white text
 * ┌──────────┐
 * │    42    │  ← x (int)
 * └──────────┘
 */
const PrimitiveBox = ({ variable, theme }) => {
    const { name, type, value, isPointer } = variable;

    const displayValue = isPointer ? "●" : value;

    return (
        <div className={`primitive-box ${theme} ${isPointer ? "pointer" : ""}`}>
            <div className="box-label">
                <span className="var-name">{name}</span>
                <span className="var-type">({type})</span>
            </div>
            <div className="box-value">
                <div className="value-cell">{String(displayValue)}</div>
            </div>
        </div>
    );
};

export default PrimitiveBox;
