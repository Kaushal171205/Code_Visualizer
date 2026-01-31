/**
 * ArrayBox - Horizontal row of connected boxes for arrays
 * 
 * Visual style matches reference image:
 * ┌────┬────┬────┬────┬────┐
 * │ 10 │ 20 │ 30 │ 40 │ 50 │
 * └────┴────┴────┴────┴────┘
 *  [0]  [1]  [2]  [3]  [4]
 */
const ArrayBox = ({ variable, theme }) => {
    const { name, type, value } = variable;

    // Ensure value is an array
    const elements = Array.isArray(value) ? value : [];

    return (
        <div className={`array-box ${theme}`}>
            <div className="box-label">
                <span className="var-name">{name}</span>
                <span className="var-type">({type})</span>
            </div>
            <div className="array-container">
                <div className="array-cells">
                    {elements.map((element, index) => (
                        <div key={index} className="array-cell">
                            <div className="cell-value">{String(element)}</div>
                        </div>
                    ))}
                </div>
                <div className="array-indices">
                    {elements.map((_, index) => (
                        <div key={index} className="index-label">
                            [{index}]
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ArrayBox;
