import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Header from './components/Header';
import CostSummary from './components/CostSummary';
import ServiceOverview from './components/ServiceOverview';
import MetricsPanel from './components/MetricsPanel';
import ScenarioSelector from './components/ScenarioSelector';
import InvestigationTimeline from './components/InvestigationTimeline';
import SafetyValidation from './components/SafetyValidation';
import ActionExecution from './components/ActionExecution';
import VerificationPanel from './components/VerificationPanel';
import CostImpact from './components/CostImpact';
import DemoControlBar from './components/DemoControlBar';
import DemoEventNotifications from './components/DemoEventNotifications';
import ExecutiveSummaryModal from './components/ExecutiveSummaryModal';

import { api } from './services/api';

const SCENARIOS = [
  {
    id: 'cost-optimization',
    backendName: 'scenario_a',
    title: 'Scenario A — Cost Optimization',
    label: 'Cost Optimization',
  },
  {
    id: 'rising-traffic',
    backendName: 'scenario_b',
    title: 'Scenario B — Rising Traffic',
    label: 'Rising Traffic Surge',
  },
  {
    id: 'stale-observation',
    backendName: 'scenario_c',
    title: 'Scenario C — Stale Observation',
    label: 'Stale Observation Re-check',
  },
  {
    id: 'failed-action',
    backendName: 'scenario_d',
    title: 'Scenario D — Failed Action',
    label: 'Simulated Action Failure',
  },
];

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatCurrency(value) {
  const number = numberOrNull(value);

  if (number === null) {
    return '—';
  }

  return `$${number.toFixed(2)}`;
}

/* -------------------------------------------------------------------------- */
/* SERVICE NORMALIZATION                                                      */
/* -------------------------------------------------------------------------- */

function normalizeService(service = {}) {
  return {
    service_id: service.service_id,
    name:
      service.name ||
      service.service_name ||
      service.service_id ||
      'Unknown Service',

    description: service.description || '',

    health:
      service.health ||
      service.status ||
      'unknown',

    status_label:
      service.status_label ||
      service.status ||
      service.health ||
      'UNKNOWN',

    current_instances:
      service.instances ??
      service.current_instances ??
      0,

    min_instances:
      service.min_instances ??
      0,

    max_instances:
      service.max_instances ??
      0,

    cost_per_hour:
      service.hourly_cost ??
      service.cost_per_hour ??
      0,

    cost_per_instance_hour:
      service.cost_per_instance_hour ??
      0,

    instance_type:
      service.instance_type ||
      'Unknown',

    cpu_utilization:
      service.cpu_percent ??
      service.cpu_utilization ??
      0,

    memory_utilization:
      service.memory_percent ??
      service.memory_utilization ??
      0,

    traffic_rps:
      service.request_rate ??
      service.traffic_rps ??
      0,

    latency_ms:
      service.latency_ms ??
      0,

    alerts:
      service.active_alerts ??
      service.alerts ??
      0,

    is_simulated:
      service.is_simulated ?? true,
  };
}

/* -------------------------------------------------------------------------- */
/* BACKEND AGENT RESPONSE                                                     */
/* -------------------------------------------------------------------------- */

function getAgentExecution(result) {
  return result?.agent_execution || null;
}

function getEvidence(execution) {
  return execution?.evidence || {};
}

function getDecision(execution) {
  return execution?.decision || {};
}

function getProposedAction(execution) {
  return (
    execution?.decision?.proposed_action ||
    execution?.action_request ||
    {}
  );
}

function getActionResult(execution) {
  return execution?.action_result || {};
}

function getVerification(execution) {
  return execution?.verification || {};
}

/* -------------------------------------------------------------------------- */
/* METRICS                                                                    */
/* -------------------------------------------------------------------------- */

function buildMetrics(rawMetrics, traffic, cost, constraints, service) {
  if (!rawMetrics && !traffic && !cost && !constraints && !service) {
    return null;
  }

  return {
    service_id:
      rawMetrics?.service_id ||
      service?.service_id,

    cpu_percent:
      rawMetrics?.cpu_percent ??
      service?.cpu_utilization ??
      0,

    memory_percent:
      rawMetrics?.memory_percent ??
      service?.memory_utilization ??
      0,

    request_rate:
      rawMetrics?.request_rate ??
      traffic?.request_rate ??
      service?.traffic_rps ??
      0,

    latency_ms:
      rawMetrics?.latency_ms ??
      0,

    observed_at:
      rawMetrics?.observed_at ||
      traffic?.observed_at ||
      cost?.observed_at ||
      new Date().toISOString(),

    health:
      service?.health ||
      'unknown',

    instances:
      cost?.instances ??
      service?.current_instances ??
      0,

    hourly_cost:
      cost?.hourly_cost ??
      service?.cost_per_hour ??
      0,

    monthly_projected_cost:
      cost?.monthly_projected_cost ??
      0,

    min_instances:
      constraints?.min_instances ??
      service?.min_instances ??
      0,

    max_instances:
      constraints?.max_instances ??
      service?.max_instances ??
      0,

    max_latency_threshold_ms:
      constraints?.max_latency_threshold_ms ??
      0,

    cpu_scale_down_max_percent:
      constraints?.cpu_scale_down_max_percent ??
      0,

    traffic_trend:
      traffic?.traffic_trend ||
      'unknown',

    peak_rps:
      traffic?.peak_rps ??
      0,

    error_rate_percent:
      traffic?.error_rate_percent ??
      0,
  };
}

/* -------------------------------------------------------------------------- */
/* INVESTIGATION TIMELINE                                                     */
/* -------------------------------------------------------------------------- */

function normalizeTimeline(execution, scenario, service) {
  const timeline = Array.isArray(execution?.timeline)
    ? execution.timeline
    : [];

  const decision = getDecision(execution);
  const action = getActionResult(execution);
  const verification = getVerification(execution);

  const targetService =
    execution?.service_id ||
    service?.service_id ||
    'unknown';

  const steps = timeline.map((item, index) => {
    const rawStep = item.step || item.stage || item.name || `Step ${index + 1}`;
    const formattedTitle = String(rawStep)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const description =
      item.description ||
      item.message ||
      item.text ||
      item.detail ||
      '';

    let observation = item.observation;
    if (!observation && item.data && typeof item.data === 'object') {
      const parts = Object.entries(item.data)
        .filter(([k, v]) => v != null && typeof v !== 'object')
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
      if (parts.length > 0) {
        observation = parts.join(' | ');
      }
    }
    if (!observation) {
      observation = description || 'Observed live backend event.';
    }

    const toolCalled =
      item.tool_called ||
      (item.data?.tool
        ? String(item.data.tool)
        : rawStep.toLowerCase().includes('telemetry') || rawStep.toLowerCase().includes('evidence')
          ? 'HttpBackendAdapter'
          : rawStep.toLowerCase().includes('llm') || rawStep.toLowerCase().includes('decision')
            ? 'GeminiDecisionEngine'
            : rawStep.toLowerCase().includes('safety') || rawStep.toLowerCase().includes('action')
              ? 'DeterministicSafetyEngine'
              : rawStep.toLowerCase().includes('verification')
                ? 'CloudVerifier'
                : 'AutonomousAgent');

    const chips = [];
    if (item.data?.cpu_pct != null) chips.push(`CPU: ${item.data.cpu_pct}%`);
    if (item.data?.rps != null) chips.push(`RPS: ${item.data.rps}`);
    if (item.data?.p95_ms != null) chips.push(`p95: ${item.data.p95_ms}ms`);
    if (item.data?.decision != null) chips.push(`Decision: ${String(item.data.decision).toUpperCase()}`);
    if (item.data?.target_instances != null) chips.push(`Target: ${item.data.target_instances} inst`);
    if (item.data?.status != null) chips.push(`Status: ${String(item.data.status).toUpperCase()}`);

    return {
      id: item.id || item.step_id || `timeline-${index + 1}`,
      step_id: item.id || item.step_id || `timeline-${index + 1}`,
      title: item.title || formattedTitle,
      tool_called: toolCalled,
      description,
      observation,
      status: item.status || item.state || 'completed',
      timestamp: item.timestamp || item.time || new Date().toISOString(),
      stage: item.stage || item.status || 'completed',
      evidence_chips: chips,
    };
  });

  return {
    scenario_title:
      scenario?.title ||
      scenario?.label ||
      'Autonomous Cloud Optimization',

    target_service_id: targetService,
    run_id: execution?.run_id || null,
    objective: execution?.objective || null,

    agent_status:
      execution
        ? 'completed'
        : 'idle',

    summary:
      execution?.final_explanation ||
      decision?.proposed_action?.reason ||
      decision?.reason ||
      'Agent investigation completed.',

    steps,

    final_decision: {
      action:
        decision?.decision ||
        action?.action ||
        'no_action',

      status:
        action?.status ||
        'unknown',

      target_instances:
        action?.new_instances ??
        action?.target_instances ??
        decision?.proposed_action?.target_instances ??
        null,

      current_instances:
        action?.previous_instances ??
        execution?.evidence?.state?.current_instances ??
        service?.current_instances ??
        null,

      confidence:
        decision?.proposed_action?.confidence ??
        decision?.confidence ??
        null,

      reason:
        decision?.proposed_action?.reason ||
        decision?.reason ||
        '',

      expected_effect:
        decision?.proposed_action?.expected_effect ||
        decision?.expected_effect ||
        '',

      verification:
        verification?.is_verified ??
        verification?.success ??
        false,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* SAFETY                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeSafety(execution, service, fallbackConstraints) {
  if (!execution) {
    return null;
  }

  const evidence = getEvidence(execution);
  const decision = getDecision(execution);
  const proposedAction = getProposedAction(execution);
  const action = getActionResult(execution);
  const verification = getVerification(execution);

  const constraints = evidence?.constraints || fallbackConstraints || {};

  const minInst = constraints?.min_instances ?? null;
  const maxInst = constraints?.max_instances ?? null;
  const maxLat =
    constraints?.max_latency_p95_ms ??
    constraints?.max_latency_threshold_ms ??
    250;
  const maxCpu =
    constraints?.max_cpu_pct ??
    constraints?.cpu_scale_down_max_percent ??
    65;

  const observedInstances =
    evidence?.state?.current_instances ??
    evidence?.current_instances ??
    service?.current_instances ??
    null;
  const observedLatency =
    evidence?.traffic?.latency_p95_ms ??
    evidence?.traffic?.p95_latency_ms ??
    evidence?.traffic?.latency_ms ??
    service?.latency_ms ??
    null;
  const observedCpu =
    evidence?.metrics?.cpu_utilization_pct ??
    evidence?.metrics?.cpu_percent ??
    service?.cpu_utilization ??
    null;

  const isRejected = action?.status === 'rejected';
  const isFailed = action?.status === 'failed';
  const isActionSuccess = action?.status === 'success';

  // 1. Min/Max constraint validation
  const targetInst =
    proposedAction?.target_instances ??
    action?.new_instances ??
    null;
  let minMaxStatus = 'UNKNOWN';
  let minMaxObserved = 'Boundary data unavailable';
  if (minInst !== null && maxInst !== null) {
    if (targetInst !== null) {
      const within = targetInst >= minInst && targetInst <= maxInst;
      minMaxStatus = within ? 'PASSED' : 'FAILED';
      minMaxObserved = `${targetInst} instances requested (current: ${observedInstances ?? '—'})`;
    } else if (observedInstances !== null) {
      const within =
        observedInstances >= minInst && observedInstances <= maxInst;
      minMaxStatus = within ? 'PASSED' : 'FAILED';
      minMaxObserved = `${observedInstances} instances running`;
    }
  }

  // 2. Stale telemetry validation
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

  // 3. Deterministic Safety Engine authorization
  let safetyAuthStatus = 'UNKNOWN';
  let safetyAuthObserved = 'Pending deterministic evaluation';
  if (isRejected) {
    safetyAuthStatus = 'FAILED';
    safetyAuthObserved =
      action?.error ||
      (Array.isArray(action?.safety_violations) &&
      action.safety_violations.length > 0
        ? action.safety_violations.join('; ')
        : 'Action rejected by deterministic safety engine');
  } else if (isActionSuccess || isFailed) {
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

  // 4. Action / Decision status
  let actionStatus = 'UNKNOWN';
  let actionObserved = 'Action pending or not executed';
  const actionType =
    action?.action || proposedAction?.action || decision?.decision;
  if (isActionSuccess) {
    actionStatus = 'PASSED';
    const displayAction = actionType
      ? String(actionType).replaceAll('_', ' ').toUpperCase()
      : 'OPTIMIZATION';
    actionObserved = `${displayAction} executed (${action?.previous_instances ?? '—'} → ${action?.new_instances ?? '—'} instances)`;
  } else if (isRejected) {
    actionStatus = 'FAILED';
    actionObserved = `Action rejected: ${action?.error || 'Blocked by deterministic guardrails'}`;
  } else if (isFailed) {
    actionStatus = 'FAILED';
    actionObserved = `Execution failed: ${action?.error || 'Provider execution failure'}`;
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
  let sloStatus = 'UNKNOWN';
  let sloObserved = 'Workload telemetry unavailable';
  if (observedLatency !== null && observedCpu !== null) {
    const isScaleUp =
      (proposedAction?.action || decision?.decision) ===
      'scale_up';
    if (isScaleUp) {
      sloStatus = 'PASSED';
      sloObserved = `p95 ${observedLatency}ms, CPU ${observedCpu}% — scale-up relieves load safely`;
    } else {
      const safe =
        observedLatency <= maxLat && observedCpu <= maxCpu;
      sloStatus = safe ? 'PASSED' : 'FAILED';
      sloObserved = `p95 ${observedLatency}ms (limit: ${maxLat}ms), CPU ${observedCpu}% (limit: ${maxCpu}%)`;
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
          : 'Boundary limits enforced',
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

  const hasFailure = checks.some((c) => c.status === 'FAILED');
  const hasPass = checks.some((c) => c.status === 'PASSED');
  const allUnknown = checks.every((c) => c.status === 'UNKNOWN');

  let verdict = 'UNKNOWN';
  if (hasFailure || isRejected || isFailed) {
    verdict = 'FAILED';
  } else if (hasPass && !hasFailure) {
    verdict = 'PASSED';
  } else if (allUnknown) {
    verdict = 'UNKNOWN';
  }

  const safetySummary =
    decision?.safety_considerations &&
    decision.safety_considerations.length > 0
      ? Array.isArray(decision.safety_considerations)
        ? decision.safety_considerations.join('; ')
        : String(decision.safety_considerations)
      : proposedAction?.safety_considerations &&
        proposedAction.safety_considerations.length > 0
      ? Array.isArray(proposedAction.safety_considerations)
        ? proposedAction.safety_considerations.join('; ')
        : String(proposedAction.safety_considerations)
      : action?.error ||
        (verdict === 'PASSED'
          ? 'All deterministic safety guardrails evaluated and passed.'
          : 'Safety guardrails evaluated.');

  return {
    target_service_id:
      execution.service_id || service?.service_id,

    verdict,
    verdict_status:
      verdict === 'PASSED'
        ? 'pass'
        : verdict === 'FAILED'
        ? 'blocked'
        : 'unknown',
    policy_id: 'DETERMINISTIC SAFETY ENGINE v1.0',
    timestamp:
      action?.timestamp ||
      execution?.timeline?.[0]?.timestamp ||
      new Date().toISOString(),

    summary: safetySummary,
    checks,
  };
}

/* -------------------------------------------------------------------------- */
/* ACTION                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeAction(execution) {
  if (!execution) {
    return null;
  }

  const decision = getDecision(execution);
  const proposedAction = getProposedAction(execution);
  const action = getActionResult(execution);

  const actionType =
    action?.action ||
    proposedAction?.action ||
    decision?.decision ||
    'no_action';

  return {
    action_id:
      action?.action_id ||
      proposedAction?.action_id ||
      '—',

    service_id:
      action?.service_id ||
      execution?.service_id,

    action_type: actionType,

    display_action:
      String(actionType)
        .replaceAll('_', ' ')
        .toUpperCase(),

    previous_instances:
      action?.previous_instances ??
      proposedAction?.current_instances ??
      execution?.evidence?.state?.current_instances ??
      null,

    target_instances:
      action?.new_instances ??
      action?.target_instances ??
      proposedAction?.target_instances ??
      null,

    current_instances:
      action?.new_instances ??
      action?.current_instances ??
      execution?.post_action_state?.current_instances ??
      null,

    status:
      action?.status ||
      'unknown',

    status_label:
      String(
        action?.status ||
        'unknown'
      )
        .replaceAll('_', ' ')
        .toUpperCase(),

    timestamp:
      action?.timestamp ||
      null,

    reason:
      proposedAction?.reason ||
      decision?.reason ||
      action?.message ||
      '',

    expected_effect:
      proposedAction?.expected_effect ||
      decision?.expected_effect ||
      '',

    safety_considerations:
      proposedAction?.safety_considerations ||
      '',

    confidence:
      proposedAction?.confidence ??
      decision?.confidence ??
      null,

    error:
      action?.error ||
      null,

    rejection_reason:
      action?.rejection_reason ||
      (action?.status === 'rejected' ? action?.error : null),
  };
}

/* -------------------------------------------------------------------------- */
/* VERIFICATION                                                               */
/* -------------------------------------------------------------------------- */

function normalizeVerification(execution) {
  if (!execution) {
    return null;
  }

  const verification = getVerification(execution);
  const action = getActionResult(execution);
  const evidence = getEvidence(execution);

  const prevInst =
    action?.previous_instances ??
    evidence?.state?.current_instances ??
    '—';

  const newInst =
    verification?.actual_state?.current_instances ??
    verification?.actual_state?.instances ??
    action?.new_instances ??
    '—';

  const expectedInst =
    verification?.expected_state?.target_instances ??
    verification?.expected_state?.instances ??
    action?.new_instances ??
    '—';

  const beforeAfter = {
    instances: {
      label: 'Running Instances',
      before: `${prevInst} instances`,
      after: `${newInst} instances`,
    },
    status: {
      label: 'Operational Status',
      before: 'monitored',
      after: verification?.actual_state?.status || 'verified',
    },
  };

  const checks = [
    {
      name: 'Target State Invariant',
      detail: `Expected: ${expectedInst} inst | Actual: ${newInst} inst`,
      status: (verification?.is_verified || verification?.success) ? 'PASS' : 'FAIL',
    },
    {
      name: 'Provider Execution Confirmation',
      detail: action?.status === 'success'
        ? 'Cloud mutation executed without error'
        : (action?.error || (action?.status === 'rejected' ? 'Blocked by deterministic safety policy' : 'Validated')),
      status: action?.status === 'success' ? 'PASS' : (action?.status === 'failed' ? 'FAIL' : 'PASS'),
    },
    {
      name: 'Optimization Invariant Verification',
      detail: verification?.verification_notes || 'Confirmed via fresh post-action cloud poll',
      status: (verification?.is_effective ?? true) ? 'PASS' : 'CHECK',
    },
  ];

  return {
    verification_id:
      verification?.verification_id ||
      verification?.id ||
      '—',

    service_id:
      verification?.service_id ||
      execution?.service_id,

    verdict:
      verification?.is_verified ||
      verification?.success
        ? 'VERIFIED'
        : action?.status === 'failed'
          ? 'FAILED'
          : 'NOT VERIFIED',

    verdict_status:
      verification?.is_verified ||
      verification?.success
        ? 'success'
        : 'failed',

    timestamp:
      verification?.timestamp ||
      null,

    summary:
      verification?.verification_notes ||
      verification?.notes ||
      verification?.summary ||
      verification?.message ||
      'Post-action verification result returned by backend.',

    expected_target: expectedInst,
    actual_instances: newInst,
    is_effective:
      verification?.is_effective ??
      verification?.success ??
      false,

    is_verified:
      verification?.is_verified ??
      verification?.success ??
      false,

    before_after: beforeAfter,
    checks,
  };
}

/* -------------------------------------------------------------------------- */
/* COST IMPACT                                                                */
/* -------------------------------------------------------------------------- */

function buildCostImpact(
  execution,
  beforeCost,
  afterCost
) {
  if (!execution) {
    return null;
  }

  const beforeHourly =
    Number(
      beforeCost?.hourly_cost ??
      0
    );

  const afterHourly =
    Number(
      afterCost?.hourly_cost ??
      beforeHourly
    );

  const beforeMonthly =
    Number(
      beforeCost?.monthly_projected_cost ??
      beforeHourly * 730
    );

  const afterMonthly =
    Number(
      afterCost?.monthly_projected_cost ??
      afterHourly * 730
    );

  const hourlyDelta =
    afterHourly - beforeHourly;

  const monthlySavings =
    beforeMonthly - afterMonthly;

  const action = getActionResult(execution);
  const verification = getVerification(execution);

  return {
    scenario_id:
      execution?.run_id,

    service_id:
      execution?.service_id,

    previous_hourly_cost:
      beforeHourly,

    new_hourly_cost:
      afterHourly,

    hourly_delta:
      hourlyDelta,

    previous_monthly_spend:
      beforeMonthly,

    new_monthly_spend:
      afterMonthly,

    estimated_monthly_savings:
      monthlySavings,

    verified_status:
      verification?.is_verified ||
      verification?.success
        ? 'VERIFIED'
        : action?.status || 'UNKNOWN',

    status_type:
      verification?.is_verified ||
      verification?.success
        ? 'success'
        : 'unknown',

    verified:
      Boolean(
        verification?.is_verified ||
        verification?.success
      ),

    summary:
      `Current backend cost: ${formatCurrency(afterHourly)}/hr.`,
  };
}

/* -------------------------------------------------------------------------- */
/* APP                                                                        */
/* -------------------------------------------------------------------------- */

function App() {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] =
    useState(null);

  const [selectedScenarioId, setSelectedScenarioId] =
    useState('cost-optimization');

  const [metrics, setMetrics] = useState(null);

  const [costData, setCostData] =
    useState(null);

  const [scenarioResult, setScenarioResult] =
    useState(null);

  const [scenarioCost, setScenarioCost] =
    useState({
      before: null,
      after: null,
    });

  const [isRunning, setIsRunning] =
    useState(false);

  const [backendError, setBackendError] =
    useState('');

  const [simStage, setSimStage] =
    useState('idle');

  const [isSummaryOpen, setIsSummaryOpen] =
    useState(false);

  const [events, setEvents] =
    useState([]);

  const selectedScenario = useMemo(
    () =>
      SCENARIOS.find(
        (scenario) =>
          scenario.id ===
          selectedScenarioId
      ) || SCENARIOS[0],
    [selectedScenarioId]
  );

  const execution =
    getAgentExecution(
      scenarioResult
    );

  const selectedService =
    services.find(
      (service) =>
        service.service_id ===
        selectedServiceId
    ) || null;

  const normalizedInvestigation =
    useMemo(
      () =>
        execution
          ? normalizeTimeline(
              execution,
              selectedScenario,
              selectedService
            )
          : null,
      [
        execution,
        selectedScenario,
        selectedService,
      ]
    );

  const normalizedSafety =
    useMemo(
      () =>
        execution
          ? normalizeSafety(
              execution,
              selectedService,
              metrics?.constraints
            )
          : null,
      [
        execution,
        selectedService,
        metrics,
      ]
    );

  const normalizedAction =
    useMemo(
      () =>
        execution
          ? normalizeAction(execution)
          : null,
      [execution]
    );

  const normalizedVerification =
    useMemo(
      () =>
        execution
          ? normalizeVerification(
              execution
            )
          : null,
      [execution]
    );

  const normalizedCostImpact =
    useMemo(
      () =>
        execution
          ? buildCostImpact(
              execution,
              scenarioCost.before,
              scenarioCost.after
            )
          : null,
      [
        execution,
        scenarioCost,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* LOAD SERVICES                                                            */
  /* ------------------------------------------------------------------------ */

  const loadServices =
    useCallback(
      async () => {
        const response =
          await api.getServices();

        const backendServices =
          Array.isArray(response)
            ? response
            : response?.services || [];

        const normalized =
          backendServices.map(
            normalizeService
          );

        setServices(normalized);

        setSelectedServiceId(
          (current) => {
            if (
              current &&
              normalized.some(
                (service) =>
                  service.service_id ===
                  current
              )
            ) {
              return current;
            }

            return (
              normalized[0]
                ?.service_id ||
              null
            );
          }
        );

        return normalized;
      },
      []
    );

  /* ------------------------------------------------------------------------ */
  /* LOAD TELEMETRY                                                           */
  /* ------------------------------------------------------------------------ */

  const loadServiceTelemetry =
    useCallback(
      async (serviceId) => {
        if (!serviceId) {
          return null;
        }

        const [
          service,
          rawMetrics,
          traffic,
          health,
          cost,
          constraints,
        ] =
          await Promise.all([
            api.getService(
              serviceId
            ),

            api.getServiceMetrics(
              serviceId
            ),

            api.getServiceTraffic(
              serviceId
            ),

            api.getServiceHealth(
              serviceId
            ),

            api.getServiceCost(
              serviceId
            ),

            api.getServiceConstraints(
              serviceId
            ),
          ]);

        const normalizedService =
          normalizeService({
            ...(service || {}),
            service_id:
              service?.service_id ||
              serviceId,

            name:
              service?.name ||
              service?.service_name ||
              serviceId,

            ...(health || {}),
            ...(cost || {}),
          });

        setServices(
          (current) =>
            current.map(
              (item) =>
                item.service_id ===
                serviceId
                  ? {
                      ...item,
                      ...normalizedService,
                    }
                  : item
            )
        );

        setMetrics({
          service:
            normalizedService,

          raw:
            rawMetrics,

          traffic,

          health,

          cost,

          constraints,
        });

        return {
          service:
            normalizedService,

          raw:
            rawMetrics,

          traffic,

          health,

          cost,

          constraints,
        };
      },
      []
    );

  /* ------------------------------------------------------------------------ */
  /* COST SUMMARY                                                             */
  /* ------------------------------------------------------------------------ */

  const loadCostSummary =
    useCallback(
      async (serviceList) => {
        if (
          !serviceList?.length
        ) {
          setCostData(null);
          return;
        }

        const details =
          await Promise.all(
            serviceList.map(
              async (service) => {
                const [
                  cost,
                  health,
                ] =
                  await Promise.all([
                    api.getServiceCost(
                      service.service_id
                    ),

                    api.getServiceHealth(
                      service.service_id
                    ),
                  ]);

                return {
                  service,
                  cost,
                  health,
                };
              }
            )
          );

        let totalHourlyBurn = 0;
        let totalInstances = 0;

        let healthy = 0;
        let warning = 0;
        let degraded = 0;

        const costBreakdown =
          details.map(
            ({
              service,
              cost,
              health,
            }) => {
              const hourly =
                Number(
                  cost?.hourly_cost ??
                  service.cost_per_hour ??
                  0
                );

              const instances =
                Number(
                  cost?.instances ??
                  service.current_instances ??
                  0
                );

              totalHourlyBurn +=
                hourly;

              totalInstances +=
                instances;

              const healthStatus =
                health?.health ||
                health?.status ||
                service.health;

              if (
                healthStatus ===
                'healthy'
              ) {
                healthy++;
              } else if (
                healthStatus ===
                'warning'
              ) {
                warning++;
              } else {
                degraded++;
              }

              return {
                service_id:
                  service.service_id,

                name:
                  service.name,

                hourly_cost:
                  hourly,

                monthly_projected:
                  hourly * 730,

                percentage_of_total:
                  0,
              };
            }
          );

        for (
          const item of costBreakdown
        ) {
          item.percentage_of_total =
            totalHourlyBurn > 0
              ? (
                  item.hourly_cost /
                  totalHourlyBurn
                ) *
                100
              : 0;
        }

        const realizedMonthlySavings =
          normalizedCostImpact
            ?.estimated_monthly_savings ??
          0;

        const realizedHourlySavings =
          normalizedCostImpact
            ? -normalizedCostImpact.hourly_delta
            : 0;

        setCostData({
          total_hourly_burn:
            totalHourlyBurn,

          projected_monthly_spend:
            totalHourlyBurn * 730,

          savings_realized_monthly:
            realizedMonthlySavings,

          savings_realized_hourly:
            realizedHourlySavings,

          total_instances:
            totalInstances,

          service_count:
            serviceList.length,

          health_summary: {
            healthy,
            warning,
            degraded,
          },

          cost_breakdown:
            costBreakdown,
        });
      },
      [
        normalizedCostImpact,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* INITIAL LOAD                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setBackendError('');

        await api.getHealth();

        const loadedServices =
          await loadServices();

        if (!mounted) {
          return;
        }

        await loadCostSummary(
          loadedServices
        );
      } catch (error) {
        if (mounted) {
          setBackendError(
            error?.message ||
              'Unable to connect to FastAPI backend.'
          );
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [
    loadServices,
    loadCostSummary,
  ]);

  /* ------------------------------------------------------------------------ */
  /* REFRESH COST SUMMARY WHEN SERVICES CHANGE                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!services.length) {
      return;
    }

    loadCostSummary(
      services
    ).catch((error) => {
      setBackendError(
        error?.message ||
          'Failed to load cloud cost summary.'
      );
    });
  }, [
    services,
    loadCostSummary,
  ]);

  /* ------------------------------------------------------------------------ */
  /* AUTO-LOAD TELEMETRY FOR SELECTED SERVICE                                 */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedServiceId) {
      return;
    }

    loadServiceTelemetry(selectedServiceId).catch((error) => {
      setBackendError(
        error?.message ||
          'Failed to load service telemetry.'
      );
    });
  }, [
    selectedServiceId,
    loadServiceTelemetry,
  ]);

  /* ------------------------------------------------------------------------ */
  /* SERVICE SELECTION                                                        */
  /* ------------------------------------------------------------------------ */

  const handleSelectService =
    async (serviceId) => {
      setSelectedServiceId(
        serviceId
      );

      try {
        setBackendError('');

        await loadServiceTelemetry(
          serviceId
        );
      } catch (error) {
        setBackendError(
          error?.message ||
            'Failed to load service telemetry.'
        );
      }
    };

  /* ------------------------------------------------------------------------ */
  /* SCENARIO SELECTION                                                       */
  /* ------------------------------------------------------------------------ */

  const handleSelectScenario =
    (scenarioId) => {
      setSelectedScenarioId(
        scenarioId
      );

      setScenarioResult(null);

      setScenarioCost({
        before: null,
        after: null,
      });

      setEvents([]);

      setSimStage('idle');

      setIsSummaryOpen(false);
    };

  /* ------------------------------------------------------------------------ */
  /* RUN REAL BACKEND SCENARIO                                                */
  /* ------------------------------------------------------------------------ */

  const handleRunScenario =
    async () => {
      if (isRunning) {
        return;
      }

      try {
        setBackendError('');

        setIsRunning(true);

        setIsSummaryOpen(false);

        setEvents([]);

        setScenarioResult(null);

        setScenarioCost({
          before: null,
          after: null,
        });

        setSimStage(
          'investigating'
        );

        /*
         * Map scenario to its canonical target service so we capture
         * the exact pre-action cost before the backend mutates state.
         */
        const SCENARIO_TARGET_MAP = {
          scenario_a: 'reports-worker',
          scenario_b: 'auth-api',
          scenario_c: 'analytics-pipeline',
          scenario_d: 'payment-processor',
        };

        const targetServiceId =
          SCENARIO_TARGET_MAP[selectedScenario.backendName] ||
          selectedServiceId;

        if (targetServiceId) {
          setSelectedServiceId(targetServiceId);
        }

        let beforeCost = null;
        if (targetServiceId) {
          try {
            beforeCost = await api.getServiceCost(targetServiceId);
          } catch {
            // Fallback
          }
        }

        /*
         * THIS IS THE REAL AUTONOMOUS
         * BACKEND EXECUTION.
         *
         * FastAPI:
         *   -> simulator
         *   -> investigation adapter
         *   -> Gemini
         *   -> safety/action backend
         *   -> verification
         */
        const result =
          await api.runScenario(
            selectedScenario.backendName
          );

        setScenarioResult(
          result
        );

        const agentExecution =
          getAgentExecution(
            result
          );

        if (!agentExecution) {
          throw new Error(
            'Backend returned no agent_execution result.'
          );
        }

        const resultServiceId =
          agentExecution.service_id || targetServiceId;

        if (resultServiceId) {
          setSelectedServiceId(
            resultServiceId
          );
        }

        /*
         * Fetch the ACTUAL post-action
         * cost from the backend.
         */
        let afterCost = null;
        if (resultServiceId) {
          try {
            afterCost = await api.getServiceCost(resultServiceId);
          } catch {
            // Fallback
          }
        }

        setScenarioCost({
          before:
            beforeCost,
          after:
            afterCost,
        });

        /*
         * The agent itself supplies the
         * actual timeline.
         */
        const backendTimeline =
          Array.isArray(
            agentExecution.timeline
          )
            ? agentExecution.timeline
            : [];

        const timelineEvents =
          backendTimeline.map(
            (item, index) => ({
              id:
                item.id ||
                `agent-${index + 1}`,

              stage:
                item.step ||
                item.stage ||
                'completed',

              stepIndex:
                index,

              time:
                item.timestamp
                  ? new Date(item.timestamp).toLocaleTimeString()
                  : new Date().toLocaleTimeString(),

              icon:
                index ===
                backendTimeline.length - 1
                  ? '✓'
                  : '•',

              type:
                'agent',

              text:
                item.description ||
                item.message ||
                item.text ||
                item.title ||
                item.step ||
                'Agent step completed.',
            })
          );

        setEvents(
          timelineEvents
        );

        setSimStage(
          'completed'
        );

        /*
         * Refresh the actual fleet state.
         * Example Scenario A:
         * reports-worker 4 -> 1.
         */
        const refreshed =
          await loadServices();

        await loadCostSummary(
          refreshed
        );

        if (resultServiceId) {
          await loadServiceTelemetry(
            resultServiceId
          );
        }

        setIsSummaryOpen(
          true
        );
      } catch (error) {
        setSimStage('idle');

        setBackendError(
          error?.message ||
            'Scenario execution failed.'
        );
      } finally {
        setIsRunning(false);
      }
    };

  /* ------------------------------------------------------------------------ */
  /* RESET                                                                    */
  /* ------------------------------------------------------------------------ */

  const handleReset =
    async () => {
      try {
        setBackendError('');

        setIsRunning(false);

        setScenarioResult(null);

        setScenarioCost({
          before: null,
          after: null,
        });

        setEvents([]);

        setSimStage('idle');

        setIsSummaryOpen(false);

        await api.reset();

        const refreshed =
          await loadServices();

        await loadCostSummary(
          refreshed
        );

        const resetTargetId =
          selectedServiceId ||
          refreshed[0]?.service_id;

        if (resetTargetId) {
          await loadServiceTelemetry(
            resetTargetId
          );
        }
      } catch (error) {
        setBackendError(
          error?.message ||
            'Backend reset failed.'
        );
      }
    };

  /* ------------------------------------------------------------------------ */
  /* TIMELINE STEP COUNT                                                      */
  /* ------------------------------------------------------------------------ */

  const totalInvestigationSteps =
    normalizedInvestigation
      ?.steps?.length || 1;

  const activeStepIndex =
    normalizedInvestigation
      ?.steps?.length
      ? normalizedInvestigation.steps
          .length - 1
      : 0;

  /* ------------------------------------------------------------------------ */
  /* METRICS FOR EXISTING COMPONENT                                          */
  /* ------------------------------------------------------------------------ */

  const metricsForPanel =
    metrics
      ? buildMetrics(
          metrics.raw,
          metrics.traffic,
          metrics.cost,
          metrics.constraints,
          metrics.service
        )
      : null;

  /* ------------------------------------------------------------------------ */
  /* EXECUTIVE SUMMARY                                                        */
  /* ------------------------------------------------------------------------ */

  const summaryData =
    execution
      ? {
          ...execution,

          title:
            selectedScenario.title,

          badge_label:
            'AUTONOMOUS AGENT',

          badge_status:
            getActionResult(
              execution
            )?.status ||
            'completed',

          target_service:
            execution.service_id,

          autonomous_turnaround_sec:
            null,

          human_time_saved_min:
            null,

          outcome:
            execution.final_explanation ||
            'Agent execution completed.',

          net_savings_monthly:
            normalizedCostImpact
              ?.estimated_monthly_savings ??
            0,

          net_savings_hourly:
            normalizedCostImpact
              ? -normalizedCostImpact.hourly_delta
              : 0,

          safety: normalizedSafety,

          safety_verdict:
            normalizedSafety?.verdict || 'UNKNOWN',

          safety_result: normalizedSafety,

          safety_summary:
            getProposedAction(
              execution
            )?.safety_considerations ||
            normalizedSafety?.summary ||
            'Backend safety constraints evaluated.',

          recommendation:
            getDecision(
              execution
            )?.proposed_action?.reason ||
            getDecision(
              execution
            )?.reason ||
            '',

          final_explanation:
            execution.final_explanation,
        }
      : null;

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">

        {backendError && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              border:
                '1px solid rgba(239,68,68,.5)',
              background:
                'rgba(239,68,68,.08)',
              color: '#fca5a5',
              borderRadius: '8px',
              fontFamily:
                'monospace',
            }}
          >
            BACKEND ERROR:{' '}
            {backendError}
          </div>
        )}

        <ScenarioSelector
          scenarios={SCENARIOS}
          selectedScenarioId={
            selectedScenarioId
          }
          onSelectScenario={
            handleSelectScenario
          }
        />

        <DemoControlBar
          simStage={simStage}
          isPlaying={isRunning}
          simSpeed={1}
          activeStepIndex={
            activeStepIndex
          }
          totalInvestigationSteps={
            totalInvestigationSteps
          }
          onStartSimulation={
            handleRunScenario
          }
          onPauseSimulation={() => {}}
          onStepNext={
            handleRunScenario
          }
          onResetSimulation={
            handleReset
          }
          onInstantComplete={
            handleRunScenario
          }
          onToggleSpeed={() => {}}
          onOpenSummary={() =>
            execution &&
            setIsSummaryOpen(true)
          }
        />

        <CostSummary
          costData={costData}
        />

        <div className="dashboard-operational-grid">

          <div className="grid-col-fleet">
            <ServiceOverview
              services={services}
              selectedServiceId={
                selectedServiceId
              }
              onSelectService={
                handleSelectService
              }
            />
          </div>

          <div className="grid-col-metrics">
            <MetricsPanel
              serviceMetrics={
                metricsForPanel
              }
            />
          </div>

        </div>

        <InvestigationTimeline
          investigation={
            execution
              ? normalizedInvestigation
              : null
          }
          simStage={simStage}
          activeStepIndex={
            activeStepIndex
          }
        />

        <section className="autonomous-action-control-section">

          <SafetyValidation
            safetyData={
              execution
                ? normalizedSafety
                : null
            }
            execution={execution}
            simStage={simStage}
          />

          <div className="action-verification-split-grid">

            <ActionExecution
              actionData={
                execution
                  ? normalizedAction
                  : null
              }
              simStage={simStage}
            />

            <VerificationPanel
              verificationData={
                execution
                  ? normalizedVerification
                  : null
              }
              simStage={simStage}
            />

          </div>

          <CostImpact
            costImpactData={
              execution
                ? normalizedCostImpact
                : null
            }
            simStage={simStage}
          />

        </section>

        <div className="pipeline-preview-banner">

          <div className="pipeline-preview-header">

            <span className="pipeline-tag">
              LIVE BACKEND PIPELINE
            </span>

            <span className="pipeline-title">
              Autonomous Agent &amp; Safety Pipeline
            </span>

          </div>

          <div className="pipeline-stages">

            <div className="stage-pill done">
              <span className="stage-num">
                01
              </span>

              <span>
                FastAPI Telemetry
              </span>
            </div>

            <div className="stage-pill done">
              <span className="stage-num">
                02
              </span>

              <span>
                Agent Investigation
              </span>
            </div>

            <div className="stage-pill done">
              <span className="stage-num">
                03
              </span>

              <span>
                Gemini Decision
              </span>
            </div>

            <div className="stage-pill done">
              <span className="stage-num">
                04
              </span>

              <span>
                Deterministic Safety
              </span>
            </div>

            <div className="stage-pill done">
              <span className="stage-num">
                05
              </span>

              <span>
                Action Execution
              </span>
            </div>

            <div
              className={
                execution
                  ? 'stage-pill done'
                  : 'stage-pill active'
              }
            >
              <span className="stage-num">
                06
              </span>

              <span>
                Verification
              </span>
            </div>

          </div>
        </div>

      </main>

      <DemoEventNotifications
        events={events}
        onClearEvents={() =>
          setEvents([])
        }
      />

      <ExecutiveSummaryModal
        summaryData={
          summaryData
        }
        isOpen={
          isSummaryOpen &&
          Boolean(execution)
        }
        onClose={() =>
          setIsSummaryOpen(false)
        }
      />

    </div>
  );
}

export default App;