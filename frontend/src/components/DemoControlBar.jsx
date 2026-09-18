import React from 'react';

function DemoControlBar({
  simStage,
  isPlaying,
  simSpeed,
  activeStepIndex,
  totalInvestigationSteps,
  onStartSimulation,
  onPauseSimulation,
  onStepNext,
  onResetSimulation,
  onInstantComplete,
  onToggleSpeed,
  onOpenSummary,
}) {
  const STAGES = [
    { key: 'idle', label: 'STANDBY', short: 'Standby' },
    { key: 'investigating', label: 'INVESTIGATING', short: 'Investigation' },
    { key: 'safety_checking', label: 'SAFETY CHECKING', short: 'Safety Engine' },
    { key: 'action_dispatch', label: 'DISPATCHING ACTION', short: 'Action' },
    { key: 'verifying', label: 'AUDITING STATE', short: 'Verification' },
    { key: 'completed', label: 'CYCLE COMPLETED', short: 'Complete' },
  ];

  const currentStageIndex = STAGES.findIndex((s) => s.key === simStage);

  const getStatusReadout = () => {
    switch (simStage) {
      case 'idle':
        return 'STANDBY — Awaiting autonomous trigger';
      case 'investigating':
        return `AUTONOMOUS INVESTIGATION — Step ${activeStepIndex + 1} of ${totalInvestigationSteps}`;
      case 'safety_checking':
        return 'DETERMINISTIC SAFETY ENGINE — Validating invariants';
      case 'action_dispatch':
        return 'INFRASTRUCTURE DISPATCH — Executing cloud mutation';
      case 'verifying':
        return 'POST-ACTION AUDIT — Re-polling state & verifying bounds';
      case 'completed':
        return 'AUTONOMOUS RESOLUTION — Complete & verified';
      default:
        return 'STANDBY';
    }
  };

  return (
    <div className="demo-control-bar-card">
      <div className="control-bar-header">
        <div className="control-branding">
          <span className="control-pulse-dot" data-status={simStage}></span>
          <span className="control-title">AUTONOMOUS DEMO CONTROLLER</span>
          <span className="control-status-tag mono">{getStatusReadout()}</span>
        </div>

        <div className="control-actions-row">
          {/* Play / Pause button */}
          {!isPlaying ? (
            <button
              type="button"
              className="ctrl-btn ctrl-btn-primary"
              onClick={onStartSimulation}
              title="Run automated step-by-step simulation"
            >
              <span className="btn-icon">▶</span>
              <span>{simStage === 'idle' ? 'Run Simulation' : 'Resume'}</span>
            </button>
          ) : (
            <button
              type="button"
              className="ctrl-btn ctrl-btn-pause"
              onClick={onPauseSimulation}
              title="Pause autonomous progression"
            >
              <span className="btn-icon">⏸</span>
              <span>Pause</span>
            </button>
          )}

          {/* Step Next button */}
          <button
            type="button"
            className="ctrl-btn ctrl-btn-secondary"
            onClick={onStepNext}
            disabled={simStage === 'completed'}
            title="Step manually to next phase"
          >
            <span className="btn-icon">⏭</span>
            <span>Step Next</span>
          </button>

          {/* Instant Complete */}
          <button
            type="button"
            className="ctrl-btn ctrl-btn-instant"
            onClick={onInstantComplete}
            title="Jump directly to final verified result"
          >
            <span className="btn-icon">⚡</span>
            <span>Jump to End</span>
          </button>

          {/* Reset */}
          <button
            type="button"
            className="ctrl-btn ctrl-btn-reset"
            onClick={onResetSimulation}
            title="Reset simulation to initial standby state"
          >
            <span className="btn-icon">↺</span>
            <span>Reset</span>
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            className="ctrl-btn ctrl-btn-speed"
            onClick={onToggleSpeed}
            title="Toggle playback speed (1x / 2x)"
          >
            <span className="speed-label mono">{simSpeed}x SPEED</span>
          </button>

          {/* Executive Summary Button (Visible when completed) */}
          {simStage === 'completed' && (
            <button
              type="button"
              className="ctrl-btn ctrl-btn-summary"
              onClick={onOpenSummary}
              title="View executive resolution report"
            >
              <span className="btn-icon">📋</span>
              <span>View Executive Summary</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage Progression Track */}
      <div className="control-progress-track">
        {STAGES.map((stg, idx) => {
          const isPassed = currentStageIndex > idx;
          const isCurrent = currentStageIndex === idx;

          return (
            <div
              key={stg.key}
              className={`stage-track-node ${isPassed ? 'node-passed' : ''} ${isCurrent ? 'node-current' : ''}`}
            >
              <div className="node-marker">
                {isPassed ? '✓' : idx + 1}
              </div>
              <span className="node-label">{stg.short}</span>
              {idx < STAGES.length - 1 && <div className="node-connector"></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DemoControlBar;
