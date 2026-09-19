import React from 'react';

function InvestigationTimeline({
  investigation,
  simStage = 'completed',
  activeStepIndex = 999,
}) {
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

  // Defensive normalization for backend/API responses.
  // The backend remains the source of truth; this only prevents
  // undefined/null values from crashing the visualization.
  const safeScenarioTitle =
    scenario_title || 'Autonomous Investigation';

  const safeTargetService =
    target_service_id || 'Unknown Service';

  const safeAgentStatus =
    agent_status || 'unknown';

  const safeSummary =
    summary || 'No investigation summary was returned.';

  const safeSteps =
    Array.isArray(steps) ? steps : [];

  const safeFinalDecision =
    final_decision && typeof final_decision === 'object'
      ? final_decision
      : null;

  const safeAction =
    safeFinalDecision?.action != null
      ? String(safeFinalDecision.action)
      : 'NO ACTION';

  const currentInstances =
    safeFinalDecision?.current_instances != null
      ? safeFinalDecision.current_instances
      : '—';

  const targetInstances =
    safeFinalDecision?.target_instances != null
      ? safeFinalDecision.target_instances
      : '—';

  const estimatedSavingsMonthly =
    Number(safeFinalDecision?.estimated_savings_monthly) || 0;

  // Dynamically derive step status based on current simulation progress
  const resolveStepStatus = (step, idx) => {
    const backendStatus = step?.status || 'pending';

    if (simStage === 'idle') {
      return 'pending';
    }

    if (simStage === 'investigating') {
      if (idx < activeStepIndex) {
        return backendStatus;
      }

      if (idx === activeStepIndex) {
        return 'in_progress';
      }

      return 'pending';
    }

    // For stages >= safety_checking, all investigation steps are done
    return backendStatus;
  };

  // Helper for status icon and class
  const getStatusMeta = (status) => {
    switch (status) {
      case 'completed':
        return {
          icon: '●',
          label: 'COMPLETED',
          className: 'status-completed',
        };

      case 'in_progress':
        return {
          icon: '◉',
          label: 'IN PROGRESS',
          className: 'status-active',
        };

      case 'failed':
        return {
          icon: '×',
          label: 'FAILED',
          className: 'status-failed',
        };

      case 'rejected':
        return {
          icon: '!',
          label: 'VETOED / REJECTED',
          className: 'status-rejected',
        };

      case 'warning':
        return {
          icon: '!',
          label: 'ALERT / STALE',
          className: 'status-warning',
        };

      case 'pending':
      default:
        return {
          icon: '○',
          label: 'PENDING',
          className: 'status-pending',
        };
    }
  };

  return (
    <section className="investigation-section">
      <div className="section-header">
        <div>
          <div className="investigation-eyebrow">
            AUTONOMOUS AUDIT TRAIL
          </div>

          <h2 className="section-title">
            Agent Investigation Timeline
          </h2>

          {investigation.objective && (
            <div className="investigation-objective-callout" style={{ fontSize: '0.85rem', color: '#38bdf8', marginBottom: '6px' }}>
              <strong>Objective:</strong> {investigation.objective}
            </div>
          )}

          <p className="section-subtitle">
            Autonomous telemetry queries, evidence collection, and deterministic safety checks
          </p>
        </div>

        <div className="investigation-header-tags">
          {investigation.run_id && (
            <span className="mono-pill" title="Backend Agent Run ID">
              Run: {investigation.run_id}
            </span>
          )}

          <span className="investigation-target-tag">
            Target: {safeTargetService}
          </span>

          <span
            className={`agent-status-badge ${safeAgentStatus}`}
          >
            STATUS:{' '}
            {String(safeAgentStatus)
              .replace(/_/g, ' ')
              .toUpperCase()}
          </span>
        </div>
      </div>

      {/* Investigation Synthesis Card */}
      <div className="investigation-synthesis-card">
        <div className="synthesis-header">
          <span className="synthesis-icon">🔍</span>

          <span className="synthesis-title">
            {safeScenarioTitle} — Executive Synthesis
          </span>
        </div>

        <p className="synthesis-body">
          {safeSummary}
        </p>

        {safeFinalDecision && (
          <div className="synthesis-decision-strip">
            <div className="decision-prop">
              <span className="prop-label">
                Candidate Action:
              </span>

              <span className="prop-val mono-highlight">
                {safeAction.toUpperCase()}
              </span>
            </div>

            <div className="decision-prop">
              <span className="prop-label">
                Fleet Delta:
              </span>

              <span className="prop-val">
                {currentInstances} → {targetInstances} instances
              </span>
            </div>

            {estimatedSavingsMonthly > 0 && (
              <div className="decision-prop">
                <span className="prop-label">
                  Projected FinOps Savings:
                </span>

                <span className="prop-val text-emerald">
                  +$
                  {estimatedSavingsMonthly.toFixed(2)}
                  /mo
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ordered Timeline Container */}
      <div className="timeline-container">
        <div className="timeline-track-line"></div>

        {safeSteps.length === 0 ? (
          <div className="empty-state">
            <p>
              No investigation steps were returned for this scenario.
            </p>
          </div>
        ) : (
          safeSteps.map((step, idx) => {
            const currentStatus = resolveStepStatus(
              step,
              idx
            );

            const statusMeta =
              getStatusMeta(currentStatus);

            const stepId =
              step?.step_id || `step-${idx + 1}`;

            const timestamp =
              step?.timestamp || '—';

            const title =
              step?.title || 'Investigation Step';

            const toolCalled =
              step?.tool_called || 'backend';

            const description =
              step?.description ||
              'No description was provided.';

            const observation =
              step?.observation ||
              'No observation was provided.';

            const evidenceChips =
              Array.isArray(step?.evidence_chips)
                ? step.evidence_chips
                : [];

            return (
              <div
                key={stepId}
                className={`timeline-item ${statusMeta.className}`}
              >
                {/* Node Marker */}
                <div
                  className="timeline-marker"
                  title={statusMeta.label}
                >
                  <span className="marker-icon">
                    {statusMeta.icon}
                  </span>
                </div>

                {/* Step Card */}
                <div className="timeline-content-card">
                  <div className="step-card-header">
                    <div className="step-title-group">
                      <span className="step-timestamp">
                        {timestamp}
                      </span>

                      <h3 className="step-title">
                        {title}
                      </h3>
                    </div>

                    <div className="step-status-pill">
                      <span className="step-status-label">
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="step-tool-call">
                    <span className="tool-label">
                      Tool Query:
                    </span>

                    <code className="tool-name">
                      {toolCalled}
                    </code>
                  </div>

                  <p className="step-description">
                    {description}
                  </p>

                  <div className="step-observation-box">
                    <div className="observation-label">
                      Observation / Evidence:
                    </div>

                    <div className="observation-text">
                      {observation}
                    </div>
                  </div>

                  {/* Evidence Chips / Tags */}
                  {evidenceChips.length > 0 && (
                    <div className="evidence-chips-wrapper">
                      {evidenceChips.map(
                        (chip, chipIdx) => (
                          <span
                            key={chipIdx}
                            className="evidence-chip"
                          >
                            {chip}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default InvestigationTimeline;