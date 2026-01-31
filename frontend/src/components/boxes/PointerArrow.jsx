/**
 * PointerArrow - SVG arrow connecting boxes
 *
 * Visual style: Black arrow with arrowhead
 * ●───────→
 */
const PointerArrow = ({ fromId, toId, theme, curved = false }) => {
    // In a full implementation, this would calculate positions
    // based on actual DOM element positions
    // For now, we render a simple horizontal arrow indicator

    return (
        <div className={`pointer-arrow ${theme} ${curved ? "curved" : ""}`}>
            <svg width="60" height="24" viewBox="0 0 60 24">
                {curved ? (
                    // Curved arrow (for insertions/movements like in reference image 1)
                    <path
                        d="M 5 4 Q 30 40 55 4"
                        fill="none"
                        stroke="#6b7d94"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                    />
                ) : (
                    // Straight horizontal arrow
                    <line
                        x1="5"
                        y1="12"
                        x2="50"
                        y2="12"
                        stroke={theme === "dark" ? "#ffffff" : "#1f2937"}
                        strokeWidth="2"
                    />
                )}
                {/* Arrowhead */}
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill={theme === "dark" ? "#ffffff" : "#1f2937"}
                        />
                    </marker>
                </defs>
                {/* Arrow triangle */}
                <polygon
                    points="50,12 42,6 42,18"
                    fill={theme === "dark" ? "#ffffff" : "#1f2937"}
                />
            </svg>
        </div>
    );
};

export default PointerArrow;
