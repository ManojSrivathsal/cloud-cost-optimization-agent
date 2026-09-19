import React from 'react';

/**
 * Derives deterministic safety guardrail validation results directly
 * from the real backend API scenario execution response.
 *
 * Checks:
 * 1. Deterministic safety validation (action_result.status / safety_violations / safety_considerations)
 * 2. Min/Max constraint validation (evidence.constraints min/max instances vs target)
 * 3. Stale telemetry validation (evidence.is_stale / evidence.staleness_warning)
 * 4. Action/decision status (decision.decision / action_result.status / execution error)
 * 5. Post-action verification status (verification.is_verified / verification.success / is_effective)
 */
function deriveSafetyFromBackend(safetyData, execution) {
  // Normalize source execution payload
  const raw =
    execution ||
    safetyData?.agent_execution ||
    safetyData?.execution ||
    safetyData?.result ||
    safetyData ||
    {};

  const agentExec = raw?.agent_execution || raw;

  const serviceId =
    agentExec?.service_id ||
    raw?.service_id ||
    safetyData?.target_service_id ||
    '—';

  const evidence = agentExec?.evidence || raw?.evidence || {};
  const decision = agentExec?.decision || raw?.decision || {};
  const proposedAction =
    decision?.proposed_action ||
    agentExec?.action_request ||
    raw?.action_request ||
    {};
  const actionResult =
    agentExec?.action_result ||
    raw?.action_result ||
    raw?.action ||
    {};
  const verification =
    agentExec?.verification ||
    raw?.verification ||
    {};
  const constraints =
    evidence?.constraints ||
    raw?.constraints ||
    {};
  const state = evidence?.state || raw?.state || {};

  // Check if any real backend execution or evidence data exists
  const hasBackendData = Boolean(
    agentExec?.service_id ||
      evidence?.constraints ||
      decision?.decision ||
      actionResult?.status ||
      verification?.is_verified !== undefined ||
      safetyData?.checks?.length
  );

  if (!hasBackendData) {
    return {
      target_service_id: serviceId,
      policy_id: 'DETERMINISTIC SAFETY ENGINE v1.0',
      timestamp: '—',
      verdict: 'UNKNOWN',
      verdict_status: 'unknown',
      summary: 'Safety validation data unavailable or pending execution.',
      checks: [],
      isSafe: false,
      isBlocked: false,
      isUnknown: true,
    };
  }

  // 1. Deterministic Safety Engine authorization
  let safetyAuthStatus = 'UNKNOWN';
  let safetyAuthObserved = 'Pending deterministic evaluation';
  const isRejected = actionResult?.status === 'rejected';

  if (isRejected) {
    safetyAuthStatus = 'FAILED';
    safetyAuthObserved =
      actionResult?.error ||
      (Array.isArray(actionResult?.safety_violations) &&
      actionResult.safety_violations.length > 0
        ? actionResult.safety_violations.join('; ')
        : 'Action rejected by deterministic safety engine');
  } else if (
    actionResult?.status === 'success' ||
    actionResult?.status === 'failed'
  ) {
    // Both success and provider failure occurred AFTER passing safety validation
    safetyAuthStatus = 'PASSED';
    const considerations =
      decision?.safety_considerations ||
      proposedAction?.safety_considerations;
    safetyAuthObserved =
      Array.isArray(considerations) && considerations.length > 0
        ? considerations[0]
        : 'Authorized by deterministic safety engine (0 violations)';
  } else if (
    decision?.decision === 'noop' ||
    decision?.decision === 'no_action'
  ) {
    safetyAuthStatus = 'PASSED';
    safetyAuthObserved = 'Verified safe; no mutation required';
  }

  // 2. Min/Max constraint validation
  const minInst = constraints?.min_instances ?? null;
  const maxInst = constraints?.max_instances ?? null;
  const targetInst =
    proposedAction?.target_instances ??
    actionResult?.new_instances ??
    null;
  const currentInst =
    state?.current_instances ??
    actionResult?.previous_instances ??
    null;

  let minMaxStatus = 'UNKNOWN';
  let minMaxObserved = 'Boundary data unavailable';

  if (minInst !== null && maxInst !== null) {
    if (targetInst !== null) {
      const withinBounds =
        targetInst >= minInst && targetInst <= maxInst;
      minMaxStatus = withinBounds ? 'PASSED' : 'FAILED';
      minMaxObserved = `${targetInst} instances requested (current: ${currentInst ?? '—'})`;
    } else if (currentInst !== null) {
      const withinBounds =
        currentInst >= minInst && currentInst <= maxInst;
      minMaxStatus = withinBounds ? 'PASSED' : 'FAILED';
      minMaxObserved = `${currentInst} instances running`;
    }
  }

  // 3. Stale telemetry validation
  let staleStatus = 'UNKNOWN';
  let staleObserved = 'Telemetry freshness unconfirmed';

  if (evidence?.is_stale === false) {
    staleStatus = 'PASSED';
    staleObserved = 'Fresh telemetry confirmed (is_stale = false)';
  } else if (evidence?.is_stale === true) {
    staleStatus = 'FAILED';
    staleObserved =
      evidence?.staleness_warning ||
      'Stale telemetry detected (is_stale = true)';
  }

  // 4. Action / Decision status
  let actionStatus = 'UNKNOWN';
  let actionObserved = 'Action pending or not executed';
  const actionType =
    actionResult?.action ||
    proposedAction?.action ||
    decision?.decision;

  if (actionResult?.status === 'success') {
    actionStatus = 'PASSED';
    const displayAction = actionType
      ? String(actionType).replaceAll('_', ' ').toUpperCase()
      : 'OPTIMIZATION';
    actionObserved = `${displayAction} executed (${actionResult?.previous_instances ?? '—'} → ${actionResult?.new_instances ?? '—'} instances)`;
  } else if (actionResult?.status === 'rejected') {
    actionStatus = 'FAILED';
    actionObserved = `Action rejected: ${actionResult?.error || 'Blocked by deterministic guardrails'}`;
  } else if (actionResult?.status === 'failed') {
    actionStatus = 'FAILED';
    actionObserved = `Execution failed: ${actionResult?.error || 'Provider execution failure'}`;
  } else if (
    decision?.decision === 'noop' ||
    decision?.decision === 'no_action'
  ) {
    actionStatus = 'PASSED';
    actionObserved = 'Decision: NOOP (No capacity change needed)';
  }

  // 5. Verification status
  let verifStatus = 'UNKNOWN';
  let verifObserved = 'Post-action verification pending';

  if (
    verification &&
    (verification.is_verified !== undefined ||
      verification.success !== undefined)
  ) {
    const passed =
      verification.is_verified === true &&
      (verification.success === true ||
        verification.success === undefined);
    verifStatus = passed ? 'PASSED' : 'FAILED';
    verifObserved =
      verification.verification_notes ||
      (passed
        ? 'Verified = True / Effective = True'
        : 'Verification failed');
  } else if (isRejected) {
    verifStatus = 'PASSED';
    verifObserved = 'State preserved safely; invalid mutation prevented';
  }

  // 6. SLO / Workload guardrail
  const observedLat = evidence?.traffic?.latency_p95_ms ?? null;
  const observedCpu = evidence?.metrics?.cpu_utilization_pct ?? null;
  let sloStatus = 'UNKNOWN';
  let sloObserved = 'Workload telemetry unavailable';

  if (observedLat !== null && observedCpu !== null) {
    const isScaleUp =
      (proposedAction?.action || decision?.decision) ===
      'scale_up';
    if (isScaleUp) {
      sloStatus = 'PASSED';
      sloObserved = `p95 ${observedLat}ms, CPU ${observedCpu}% — scale-up relieves load safely`;
    } else {
      const maxLat = constraints?.max_latency_p95_ms ?? 250;
      const maxCpu = constraints?.max_cpu_pct ?? 65;
      const safe =
        observedLat <= maxLat && observedCpu <= maxCpu;
      sloStatus = safe ? 'PASSED' : 'FAILED';
      sloObserved = `p95 ${observedLat}ms (limit: ${maxLat}ms), CPU ${observedCpu}% (limit: ${maxCpu}%)`;
    }
  }

  const checks = [
    {
      id: 'safety_auth',
      name: 'Deterministic Authorization',
      observed: safetyAuthObserved,
      rule: 'Zero policy violations required before cloud mutation',
      status: safetyAuthStatus,
    },
    {
      id: 'capacity_bounds',
      name: 'Capacity Boundaries',
      observed: minMaxObserved,
      rule:
        minInst !== null && maxInst !== null
          ? `${minInst} – ${maxInst} instances boundary`
          : 'Instance count within min/max boundaries',
      status: minMaxStatus,
    },
    {
      id: 'telemetry_freshness',
      name: 'Telemetry Freshness & Sync',
      observed: staleObserved,
      rule: 'Telemetry must be fresh (is_stale = false) before mutation',
      status: staleStatus,
    },
    {
      id: 'action_status',
      name: 'Action Execution Integrity',
      observed: actionObserved,
      rule: 'Action must execute cleanly without provider failure',
      status: actionStatus,
    },
    {
      id: 'state_verification',
      name: 'Post-Action State Verification',
      observed: verifObserved,
      rule: 'Live cloud state must match expected specification',
      status: verifStatus,
    },
    {
      id: 'slo_guard',
      name: 'SLO & Workload Guardrail',
      observed: sloObserved,
      rule: 'Capacity changes must protect latency SLO and avoid overload',
      status: sloStatus,
    },
  ];

  // Overall verdict derivation
  const hasFailure = checks.some((c) => c.status === 'FAILED');
  const hasPass = checks.some((c) => c.status === 'PASSED');
  const allUnknown = checks.every((c) => c.status === 'UNKNOWN');

  let verdict = 'UNKNOWN';
  if (hasFailure || isRejected || actionResult?.status === 'failed') {
    verdict = 'FAILED';
  } else if (hasPass && !hasFailure) {
    verdict = 'PASSED';
  } else if (allUnknown) {
    verdict = 'UNKNOWN';
  }

  const isSafe = verdict === 'PASSED';
  const isBlocked = verdict === 'FAILED';
  const isUnknown = verdict === 'UNKNOWN';

  let summary = '';
  if (isSafe) {
    const considerations =
      decision?.safety_considerations ||
      proposedAction?.safety_considerations;
    summary =
      Array.isArray(considerations) && considerations.length > 0
        ? considerations.join('; ')
        : actionResult?.message ||
          'All deterministic safety guardrails passed. Action authorized and verified.';
  } else if (isBlocked) {
    summary =
      actionResult?.error ||
      evidence?.staleness_warning ||
      'Safety validation failed: policy constraints violated.';
  } else {
    summary =
      'Safety verification data unavailable or pending execution.';
  }

  return {
    target_service_id: serviceId,
    policy_id: 'DETERMINISTIC SAFETY ENGINE v1.0',
    timestamp:
      actionResult?.timestamp ||
      agentExec?.timeline?.[0]?.timestamp ||
      new Date().toISOString(),
    verdict,
    verdict_status: isSafe
      ? 'pass'
      : isBlocked
      ? 'blocked'
      : 'unknown',
    summary,
    checks,
    isSafe,
    isBlocked,
    isUnknown,
  };
}

function SafetyValidation({
  safetyData,
  execution,
  simStage = 'completed',
}) {
  if (!safetyData && !execution) return null;

  const derived = deriveSafetyFromBackend(safetyData, execution);
  const {
    target_service_id,
    verdict,
    policy_id,
    timestamp,
    summary,
    checks,
    isSafe,
    isBlocked,
  } = derived;

  const isAwaiting =
    simStage === 'idle' || simStage === 'investigating';

  if (isAwaiting) {
    return (
      <section className="safety-validation-section standby-mode">
        <div className="section-header">
          <div>
            <div className="panel-eyebrow">
              DETERMINISTIC SAFETY VERIFICATION
            </div>
            <h2 className="section-title">
              Safety Engine Validation
            </h2>
          </div>
          <div className="safety-meta-tags">
            <span className="mono-pill">Engine: ARMED</span>
            <span className="mono-pill highlight">
              Target: {target_service_id}
            </span>
          </div>
        </div>

        <div className="standby-placeholder-box">
          <div className="standby-pulse-ring">🛡️</div>
          <div className="standby-text-wrap">
            <div className="standby-title">
              DETERMINISTIC SAFETY ENGINE ON STANDBY
            </div>
            <p className="standby-desc">
              Awaiting candidate action from autonomous
              investigation loop. Will enforce minimum capacity,
              SLA latency ceilings, and freshness constraints
              before authorization.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const bannerClass = isSafe
    ? 'verdict-safe'
    : isBlocked
    ? 'verdict-blocked'
    : 'verdict-unknown';

  return (
    <section className="safety-validation-section">
      <div className="section-header">
        <div>
          <div className="panel-eyebrow">
            DETERMINISTIC SAFETY VERIFICATION
          </div>
          <h2 className="section-title">
            Safety Engine Validation
          </h2>
        </div>
        <div className="safety-meta-tags">
          <span className="mono-pill">Policy: {policy_id}</span>
          <span className="mono-pill">Audit: {timestamp}</span>
          <span className="mono-pill highlight">
            Target: {target_service_id}
          </span>
        </div>
      </div>

      <div className={`safety-verdict-banner ${bannerClass}`}>
        <div className="verdict-status-box">
          <span className="verdict-icon">
            {isSafe ? '✓' : isBlocked ? '✖' : '?'}
          </span>
          <div>
            <div className="verdict-heading">
              DETERMINISTIC SAFETY VERIFICATION: {verdict}
            </div>
            <div className="verdict-subtext">{summary}</div>
          </div>
        </div>
        <div className="verdict-badge">
          {isSafe
            ? 'AUTHORIZATION: GRANTED'
            : isBlocked
            ? 'AUTHORIZATION: BLOCKED'
            : 'AUTHORIZATION: UNKNOWN'}
        </div>
      </div>

      {/* Safety Checks Grid */}
      <div className="safety-checks-grid">
        {checks.map((check, idx) => {
          const isPass =
            check?.status === 'PASSED' ||
            check?.status === 'PASS';
          const isFail =
            check?.status === 'FAILED' ||
            check?.status === 'BLOCKED';
          const cardClass = isPass
            ? 'check-pass'
            : isFail
            ? 'check-blocked'
            : 'check-unknown';
          const badgeClass = isPass
            ? 'badge-pass'
            : isFail
            ? 'badge-blocked'
            : 'badge-unknown';
          const icon = isPass ? '✓' : isFail ? '✖' : '?';

          return (
            <div
              key={check?.id || idx}
              className={`safety-check-card ${cardClass}`}
            >
              <div className="check-card-header">
                <span className="check-status-icon">{icon}</span>
                <span className="check-name">
                  {check?.name || `Rule ${idx + 1}`}
                </span>
                <span className={`check-badge ${badgeClass}`}>
                  {check?.status || 'UNKNOWN'}
                </span>
              </div>
              <div className="check-detail-row">
                <span className="check-detail-label">
                  Observed:
                </span>
                <span className="check-detail-val">
                  {check?.observed ?? 'Not provided by backend'}
                </span>
              </div>
              <div className="check-detail-row">
                <span className="check-detail-label">
                  Constraint:
                </span>
                <span className="check-detail-val mono">
                  {check?.rule ?? 'Not provided by backend'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default SafetyValidation;
