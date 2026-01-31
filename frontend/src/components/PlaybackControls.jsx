/**
 * PlaybackControls - Step forward/backward controls
 */
const PlaybackControls = ({
    onStepForward,
    onStepBackward,
    currentStep,
    totalSteps,
    theme,
}) => {
    const isAtStart = currentStep <= 0;
    const isAtEnd = currentStep >= totalSteps - 1;

    return (
        <div className={`playback-controls ${theme}`}>
            <button
                className={`control-btn step-back ${isAtStart ? "disabled" : ""}`}
                onClick={onStepBackward}
                disabled={isAtStart}
                title="Step Backward (← Arrow)"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Back</span>
            </button>

            <div className="step-display">
                <div className="step-counter">
                    <span className="current">{currentStep + 1}</span>
                    <span className="separator">/</span>
                    <span className="total">{totalSteps}</span>
                </div>
                <div className="step-progress">
                    <div
                        className="progress-fill"
                        style={{
                            width: `${totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0}%`,
                        }}
                    />
                </div>
            </div>

            <button
                className={`control-btn step-forward ${isAtEnd ? "disabled" : ""}`}
                onClick={onStepForward}
                disabled={isAtEnd}
                title="Step Forward (→ Arrow)"
            >
                <span>Next</span>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>
        </div>
    );
};

export default PlaybackControls;
