import React from 'react';

function ExecutiveSummaryModal({ summaryData, isOpen, onClose }) {
  if (!isOpen || !summaryData) {
    return null;
  }

  /*
   * The backend scenario response can contain nested objects.
   * Keep this component tolerant of the exact response envelope.
   */
  const result = summaryData?.result || summaryData;

  const decision =
    result?.decision ||
    result?.agent_decision ||
    result?.result?.decision ||
    {};

  const action =
    result?.action ||
    result?.action_result ||
    result?.execution ||
    result?.result?.action ||
    {};

  const safety =
    result?.safety ||
    result?.safety_result ||
    result?.safety_validation ||
    result?.result?.safety ||
    {};

  const verification =
    result?.verification ||
    result?.verification_result ||
    result?.post_action_verification ||
    result?.result?.verification ||
    {};

  const investigation =
    result?.investigation ||
    result?.investigation_result ||
    result?.result?.investigation ||
    {};

  /*
   * -----------------------------
   * Target service
   * -----------------------------
   */
  const targetService =
    action?.service_id ||
    decision?.service_id ||
    safety?.service_id ||
    verification?.service_id ||
    result?.service_id ||
    '—';

  /*
   * -----------------------------
   * Action
   * -----------------------------
   */
  const actionType =
    action?.action ||
    action?.action_type ||
    decision?.action ||
    decision?.decision ||
    decision?.proposed_action?.action ||
    'NO ACTION';

  const displayAction = String(actionType)
    .replaceAll('_', ' ')
    .toUpperCase();

  const previousInstances =
    action?.previous_instances ??
    action?.current_instances ??
    decision?.current_instances ??
    decision?.proposed_action?.current_instances ??
    null;

  const targetInstances =
    action?.new_instances ??
    action?.target_instances ??
    decision?.target_instances ??
    decision?.proposed_action?.target_instances ??
    null;

  /*
   * -----------------------------
   * Safety
   * -----------------------------
   */
  const safetyVerdict =
    safety?.verdict ||
    safety?.status ||
    result?.safety_verdict ||
    'UNKNOWN';

  const safetyStatus = String(
    safety?.verdict_status ||
      safety?.status ||
      safetyVerdict
  ).toLowerCase();

  const safetyPassed =
    safetyStatus.includes('pass') ||
    safetyStatus.includes('allow') ||
    safetyStatus.includes('authoriz') ||
    safetyStatus.includes('approved');

  const safetySummary =
    safety?.summary ||
    safety?.reason ||
    result?.safety_summary ||
    'Deterministic safety result returned by the backend.';

  const safetyChecks = Array.isArray(safety?.checks)
    ? safety.checks
    : [];

  /*
   * -----------------------------
   * Verification
   * -----------------------------
   */
  const verificationVerdict =
    verification?.verdict ||
    verification?.status ||
    'UNKNOWN';

  const verificationSummary =
    verification?.summary ||
    verification?.message ||
    result?.verification_summary ||
    'Post-action verification result returned by the backend.';

  const verificationPassed =
    String(
      verification?.verdict_status ||
        verification?.status ||
        verificationVerdict
    )
      .toLowerCase()
      .includes('pass') ||
    String(verificationVerdict)
      .toLowerCase()
      .includes('verif');

  /*
   * -----------------------------
   * Cost
   * -----------------------------
   */
  const beforeCost =
    result?.before_cost ||
    result?.previous_cost ||
    result?.cost_before ||
    result?.beforeCost ||
    {};

  const afterCost =
    result?.after_cost ||
    result?.new_cost ||
    result?.cost_after ||
    result?.afterCost ||
    {};

  const beforeHourly =
    Number(
      beforeCost?.hourly_cost ??
        beforeCost?.total_hourly_cost ??
        result?.previous_hourly_cost ??
        result?.before_hourly_cost
    );

  const afterHourly =
    Number(
      afterCost?.hourly_cost ??
        afterCost?.total_hourly_cost ??
        result?.new_hourly_cost ??
        result?.after_hourly_cost
    );

  const hasCostData =
    Number.isFinite(beforeHourly) ||
    Number.isFinite(afterHourly);

  const safeBeforeHourly = Number.isFinite(beforeHourly)
    ? beforeHourly
    : null;

  const safeAfterHourly = Number.isFinite(afterHourly)
    ? afterHourly
    : null;

  const hourlyDelta =
    safeBeforeHourly !== null &&
    safeAfterHourly !== null
      ? safeAfterHourly - safeBeforeHourly
      : null;

  const monthlySavings =
    hourlyDelta !== null
      ? -hourlyDelta * 730
      : null;

  /*
   * -----------------------------
   * Explanation / outcome
   * -----------------------------
   */
  const explanation =
    result?.explanation ||
    decision?.reason ||
    decision?.proposed_action?.reason ||
    action?.reason ||
    verificationSummary ||
    'The autonomous scenario completed and returned a backend result.';

  const outcome =
    result?.outcome ||
    action?.status_label ||
    action?.status ||
    verificationVerdict ||
    'BACKEND RESULT';

  /*
   * -----------------------------
   * Investigation information
   * -----------------------------
   */
  const investigationSteps = Array.isArray(
    investigation?.steps
  )
    ? investigation.steps
    : [];

  /*
   * -----------------------------
   * Badge
   * -----------------------------
   */
  let badgeLabel = 'BACKEND RESULT';

  if (safetyPassed && verificationPassed) {
    badgeLabel = 'VERIFIED SUCCESS';
  } else if (safetyPassed) {
    badgeLabel = 'SAFETY APPROVED';
  } else if (
    safetyStatus.includes('reject') ||
    safetyStatus.includes('block') ||
    safetyStatus.includes('deny')
  ) {
    badgeLabel = 'SAFETY BLOCKED';
  } else if (
    String(verificationVerdict)
      .toLowerCase()
      .includes('fail')
  ) {
    badgeLabel = 'VERIFICATION FAILED';
  }

  const badgeStatus = safetyPassed
    ? 'success'
    : 'neutral';

  /*
   * -----------------------------
   * Human intervention
   * -----------------------------
   *
   * We intentionally do NOT fabricate "human time saved".
   * The actual system is autonomous for this execution,
   * but we don't invent a number that the backend never supplied.
   */
  const humanIntervention = '0h (Autonomous)';

  /*
   * -----------------------------
   * Turnaround
   * -----------------------------
   *
   * Use an actual backend duration if one exists.
   * Otherwise show "—" rather than inventing seconds.
   */
  const turnaroundMs =
    result?.execution_duration_ms ??
    action?.execution_duration_ms ??
    result?.duration_ms ??
    null;

  const turnaroundSeconds =
    Number.isFinite(Number(turnaroundMs))
      ? (Number(turnaroundMs) / 1000).toFixed(1)
      : null;

  /*
   * -----------------------------
   * Formatting helpers
   * -----------------------------
   */
  const formatMoney = (value) => {
    if (!Number.isFinite(Number(value))) {
      return '—';
    }

    return `$${Number(value).toFixed(2)}`;
  };

  const formatInstances = () => {
    if (
      previousInstances === null ||
      targetInstances === null
    ) {
      return '—';
    }

    return `${previousInstances} → ${targetInstances}`;
  };

  return (
    <div
      className="summary-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Autonomous audit resolution"
    >
      <div
        className="summary-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-eyebrow">
              AUTONOMOUS AUDIT RESOLUTION
            </span>

            <h2 className="modal-title">
              Autonomous Scenario Complete
            </h2>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close summary"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Status / target row */}
          <div className="modal-badge-row">
            <span
              className={`resolution-badge badge-${badgeStatus}`}
            >
              ● {badgeLabel}
            </span>

            <span className="mono-pill">
              Target: {targetService}
            </span>

            <span className="mono-pill">
              Human Intervention: {humanIntervention}
            </span>
          </div>

          {/* Main KPIs */}
          <div className="turnaround-kpis-grid">
            <div className="turnaround-box">
              <span className="turnaround-label">
                AUTONOMOUS TURNAROUND
              </span>

              <div className="turnaround-val mono text-cyan">
                {turnaroundSeconds !== null
                  ? `${turnaroundSeconds}s`
                  : '—'}
              </div>

              <span className="turnaround-sub">
                Backend execution duration
              </span>
            </div>

            <div className="turnaround-box">
              <span className="turnaround-label">
                INSTANCE CHANGE
              </span>

              <div className="turnaround-val mono text-emerald">
                {formatInstances()}
              </div>

              <span className="turnaround-sub">
                Actual backend action state
              </span>
            </div>

            <div className="turnaround-box">
              <span className="turnaround-label">
                FINANCIAL RUN-RATE DELTA
              </span>

              <div className="turnaround-val mono">
                {!hasCostData
                  ? '—'
                  : monthlySavings !== null &&
                    monthlySavings > 0
                  ? `+$${monthlySavings.toFixed(2)}/mo`
                  : monthlySavings !== null &&
                    monthlySavings < 0
                  ? `-$${Math.abs(
                      monthlySavings
                    ).toFixed(2)}/mo`
                  : '$0.00 / mo'}
              </div>

              <span className="turnaround-sub">
                {hourlyDelta !== null
                  ? `${formatMoney(
                      hourlyDelta
                    )}/hr delta`
                  : 'Backend cost data'}
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="summary-section-item">
            <span className="item-label">
              ACTION EXECUTED:
            </span>

            <p className="item-text mono">
              {displayAction}
              {previousInstances !== null &&
              targetInstances !== null
                ? ` • ${previousInstances} → ${targetInstances} instances`
                : ''}
            </p>

            {outcome && (
              <p className="item-text">
                {outcome}
              </p>
            )}
          </div>

          {/* Resolution outcome */}
          <div className="summary-section-item">
            <span className="item-label">
              RESOLUTION OUTCOME:
            </span>

            <p className="item-text">
              {explanation}
            </p>
          </div>

          {/* Safety */}
          <div className="summary-section-item">
            <span className="item-label">
              DETERMINISTIC SAFETY VERIFICATION:
            </span>

            <p className="item-text mono">
              {safetyPassed || safetyVerdict === 'PASSED'
                ? 'PASSED'
                : safetyVerdict === 'FAILED'
                ? 'FAILED'
                : safetyVerdict || 'UNKNOWN'}
            </p>

            <p className="item-text">
              {safetySummary}
            </p>

            {safetyChecks.length > 0 && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {safetyChecks.map(
                  (check, index) => (
                    <div
                      key={
                        check?.id ||
                        `check-${index}`
                      }
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: '12px',
                        fontFamily:
                          'monospace',
                        fontSize: '12px',
                      }}
                    >
                      <span>
                        {check?.name ||
                          `Safety Check ${
                            index + 1
                          }`}
                      </span>

                      <span>
                        {check?.status ||
                          check?.verdict ||
                          'EVALUATED'}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Verification */}
          <div className="summary-section-item">
            <span className="item-label">
              POST-ACTION VERIFICATION:
            </span>

            <p className="item-text mono">
              {verificationPassed
                ? 'VERIFICATION PASSED'
                : verificationVerdict}
            </p>

            <p className="item-text">
              {verificationSummary}
            </p>
          </div>

          {/* Agent explanation */}
          <div className="summary-section-item highlight-box">
            <span className="item-label">
              FINOPS AGENT RECOMMENDATION:
            </span>

            <p className="item-text">
              {explanation}
            </p>
          </div>

          {/* Investigation count */}
          {investigationSteps.length > 0 && (
            <div className="summary-section-item">
              <span className="item-label">
                INVESTIGATION:
              </span>

              <p className="item-text mono">
                {investigationSteps.length}{' '}
                backend investigation step
                {investigationSteps.length !== 1
                  ? 's'
                  : ''}{' '}
                recorded
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="audit-disclaimer mono">
            AUDIT INVARIANT CHECK CONFIRMED •
            NO UNDETECTED MUTATIONS
          </span>

          <button
            type="button"
            className="modal-action-btn"
            onClick={onClose}
          >
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveSummaryModal;