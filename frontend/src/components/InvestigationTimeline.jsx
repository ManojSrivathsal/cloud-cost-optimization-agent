import React from 'react';

function InvestigationTimeline({ investigation, simStage = 'completed', activeStepIndex = 999 }) {
  if (!investigation) {
    return (
      <div className="investigation-section empty-state">
        <p>No investigation telemetry available for the current scenario.</p>
      </div>
    );
  }

  const {
    scenario_title,
    target_service_id,
    agent_status,
    summary,
    final_decision,
    steps,
  } = investigation;

  // Dynamically derive step status based on current simulation progress
  const resolveStepStatus = (step, idx) => {
    if (simStage === 'idle') {
      return 'pending';
    }
    if (simStage === 'investigating') {
      if (idx < activeStepIndex) {
        return step.status;
      }
      if (idx === activeStepIndex) {
        return 'in_progress';
      }
      return 'pending';
    }
    // For stages >= safety_checking, all investigation steps are done
    return step.status;
  };

  // Helper for status icon and class
  const getStatusMeta = (status) => {
    switch (status) {
      case 'completed':
        return { icon: '●', label: 'COMPLETED', className: 'status-completed' };
      case 'in_progress':
        return { icon: '◉', label: 'IN PROGRESS', className: 'status-active' };
      case 'failed':
        return { icon: '×', label: 'FAILED', className: 'status-failed' };
      case 'rejected':
        return { icon: '!', label: 'VETOED / REJECTED', className: 'status-rejected' };
      case 'warning':
        return { icon: '!', label: 'ALERT / STALE', className: 'status-warning' };
      case 'pending':
      default:
        return { icon: '○', label: 'PENDING', className: 'status-pending' };
    }
  };

  return (
    <section className="investigation-section">
      <div className="section-header">
        <div>
          <div className="investigation-eyebrow">AUTONOMOUS AUDIT TRAIL</div>
          <h2 className="section-title">Agent Investigation Timeline</h2>
          <p className="section-subtitle">
            Autonomous telemetry queries, evidence collection, and deterministic safety checks
          </p>
        </div>

        <div className="investigation-header-tags">
          <span className="investigation-target-tag">Target: {target_service_id}</span>
          <span className={`agent-status-badge ${agent_status}`}>
            STATUS: {agent_status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Investigation Synthesis Card */}
      <div className="investigation-synthesis-card">
        <div className="synthesis-header">
          <span className="synthesis-icon">🔍</span>
          <span className="synthesis-title">{scenario_title} — Executive Synthesis</span>
        </div>
        <p className="synthesis-body">{summary}</p>
        {final_decision && (
          <div className="synthesis-decision-strip">
            <div className="decision-prop">
              <span className="prop-label">Candidate Action:</span>
              <span className="prop-val mono-highlight">{final_decision.action.toUpperCase()}</span>
            </div>
            <div className="decision-prop">
              <span className="prop-label">Fleet Delta:</span>
              <span className="prop-val">
                {final_decision.current_instances} → {final_decision.target_instances} instances
              </span>
            </div>
            {final_decision.estimated_savings_monthly > 0 && (
              <div className="decision-prop">
                <span className="prop-label">Projected FinOps Savings:</span>
                <span className="prop-val text-emerald">
                  +${final_decision.estimated_savings_monthly.toFixed(2)}/mo
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ordered Timeline Container */}
      <div className="timeline-container">
        <div className="timeline-track-line"></div>

        {steps.map((step, idx) => {
          const currentStatus = resolveStepStatus(step, idx);
          const statusMeta = getStatusMeta(currentStatus);

          return (
            <div key={step.step_id || idx} className={`timeline-item ${statusMeta.className}`}>
              {/* Node Marker */}
              <div className="timeline-marker" title={statusMeta.label}>
                <span className="marker-icon">{statusMeta.icon}</span>
              </div>

              {/* Step Card */}
              <div className="timeline-content-card">
                <div className="step-card-header">
                  <div className="step-title-group">
                    <span className="step-timestamp">{step.timestamp}</span>
                    <h3 className="step-title">{step.title}</h3>
                  </div>

                  <div className="step-status-pill">
                    <span className="step-status-label">{statusMeta.label}</span>
                  </div>
                </div>

                <div className="step-tool-call">
                  <span className="tool-label">Tool Query:</span>
                  <code className="tool-name">{step.tool_called}</code>
                </div>

                <p className="step-description">{step.description}</p>

                <div className="step-observation-box">
                  <div className="observation-label">Observation / Evidence:</div>
                  <div className="observation-text">{step.observation}</div>
                </div>

                {/* Evidence Chips / Tags */}
                {step.evidence_chips && step.evidence_chips.length > 0 && (
                  <div className="evidence-chips-wrapper">
                    {step.evidence_chips.map((chip, chipIdx) => (
                      <span key={chipIdx} className="evidence-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default InvestigationTimeline;
