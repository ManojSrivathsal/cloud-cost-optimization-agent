/**
 * PS3 Cloud Cost Optimization Agent — Centralized Mock Data & API Layer
 * 
 * NOTE: This is a frontend mock adapter representing the contract specified in PROJECT_RULES.md.
 * It will be swapped to Laksh's FastAPI backend adapter in Phase 9.
 * Do not scatter fake data across components; all dashboard consumers query this service.
 */

const MOCK_SERVICES = [
  {
    service_id: 'reports-worker',
    name: 'Reports Generation Worker',
    description: 'Async batch worker generating client PDF & CSV reports',
    health: 'healthy',
    status_label: 'Underutilized (Idle)',
    current_instances: 4,
    min_instances: 1,
    max_instances: 8,
    cost_per_hour: 0.96, // $0.24 / hr / instance * 4
    instance_type: 'c6g.large',
    cpu_utilization: 12, // 12%
    memory_utilization: 28, // 28%
    traffic_rps: 3.2,
    latency_ms: 145,
    metrics_history: {
      cpu: [18, 15, 14, 12, 11, 12, 10, 12],
      memory: [30, 29, 28, 28, 28, 27, 28, 28],
      traffic: [8.5, 6.2, 4.0, 3.5, 3.1, 3.0, 3.2, 3.2],
      latency: [180, 160, 150, 148, 145, 142, 145, 145],
    },
    alerts: ['Low utilization detected (<20% for 45m)', 'Cost optimization candidate'],
  },
  {
    service_id: 'api-gateway',
    name: 'Core API Gateway',
    description: 'Reverse proxy and edge routing for all client REST requests',
    health: 'healthy',
    status_label: 'Active Traffic Surge',
    current_instances: 6,
    min_instances: 3,
    max_instances: 12,
    cost_per_hour: 1.80, // $0.30 / hr / instance * 6
    instance_type: 'c6g.xlarge',
    cpu_utilization: 74,
    memory_utilization: 68,
    traffic_rps: 1420.5,
    latency_ms: 38,
    metrics_history: {
      cpu: [45, 52, 58, 64, 70, 72, 74, 75],
      memory: [55, 58, 60, 62, 65, 66, 68, 68],
      traffic: [850, 980, 1100, 1250, 1340, 1390, 1420, 1450],
      latency: [22, 25, 27, 30, 34, 36, 38, 41],
    },
    alerts: ['Traffic surge: +45% in last 15m'],
  },
  {
    service_id: 'payment-service',
    name: 'Payment & Checkout Service',
    description: 'PCI-DSS compliant transaction processing engine',
    health: 'healthy',
    status_label: 'Optimal Load',
    current_instances: 3,
    min_instances: 2,
    max_instances: 6,
    cost_per_hour: 1.05,
    instance_type: 'm6g.large',
    cpu_utilization: 42,
    memory_utilization: 51,
    traffic_rps: 210.0,
    latency_ms: 62,
    metrics_history: {
      cpu: [39, 41, 40, 42, 44, 41, 42, 43],
      memory: [50, 50, 51, 51, 52, 51, 51, 51],
      traffic: [195, 205, 210, 208, 212, 215, 210, 210],
      latency: [58, 60, 61, 62, 65, 63, 62, 62],
    },
    alerts: [],
  },
  {
    service_id: 'auth-service',
    name: 'Authentication & Session Authority',
    description: 'OAuth2 / JWT token issuer and session cache validator',
    health: 'healthy',
    status_label: 'Normal',
    current_instances: 2,
    min_instances: 2,
    max_instances: 6,
    cost_per_hour: 0.50,
    instance_type: 't4g.medium',
    cpu_utilization: 34,
    memory_utilization: 44,
    traffic_rps: 540.0,
    latency_ms: 16,
    metrics_history: {
      cpu: [30, 32, 35, 33, 34, 35, 34, 34],
      memory: [42, 43, 44, 43, 44, 44, 44, 44],
      traffic: [500, 520, 535, 540, 545, 538, 540, 542],
      latency: [15, 16, 16, 17, 16, 16, 16, 16],
    },
    alerts: ['At minimum capacity constraint (min: 2)'],
  },
  {
    service_id: 'data-pipeline',
    name: 'Analytics Streaming Ingestion',
    description: 'Kafka stream ingestion consumer & ETL processor',
    health: 'warning',
    status_label: 'Elevated Memory',
    current_instances: 3,
    min_instances: 2,
    max_instances: 8,
    cost_per_hour: 1.20,
    instance_type: 'r6g.large',
    cpu_utilization: 58,
    memory_utilization: 83,
    traffic_rps: 820.0,
    latency_ms: 95,
    metrics_history: {
      cpu: [50, 52, 54, 55, 56, 58, 57, 58],
      memory: [72, 75, 78, 80, 81, 82, 83, 84],
      traffic: [780, 800, 810, 815, 820, 825, 820, 830],
      latency: [82, 85, 88, 90, 92, 94, 95, 96],
    },
    alerts: ['Memory usage >80% threshold'],
  },
];

const MOCK_SCENARIOS = [
  {
    id: 'cost-optimization',
    title: 'Scenario A: Cost Optimization',
    category: 'FinOps Idle Downscale',
    target_service_id: 'reports-worker',
    description:
      'Reports worker instance utilization dropped below 15% during off-peak hours. Autonomous agent investigates telemetry, verifies minimum constraints (min: 1), and safely scales fleet from 4 down to 1 instance.',
    expected_outcome: 'Safe scale-down: 4 -> 1 instance. Hourly cost reduced by $0.72/hr ($518.40/month saved).',
    safety_rule: 'Deterministic check validates min_instances >= 1 before issuing scale_down action.',
  },
  {
    id: 'rising-traffic',
    title: 'Scenario B: Rising Traffic Surge',
    category: 'Capacity Preservation',
    target_service_id: 'api-gateway',
    description:
      'API Gateway experiencing an active traffic surge (+45% RPS) with latency creeping from 22ms to 38ms. Cost-downscale recommendations must be blocked to preserve service reliability.',
    expected_outcome: 'Agent preserves capacity or scales up (6 -> 8 instances) despite cost increase.',
    safety_rule: 'Cost reductions vetoed when latency p95 > 35ms or traffic trend is steeply ascending.',
  },
  {
    id: 'stale-observation',
    title: 'Scenario C: Stale Observation Re-check',
    category: 'Telemetry Freshness Guard',
    target_service_id: 'reports-worker',
    description:
      'Agent receives cached 30-minute-old observation showing 0 RPS. Before issuing irreversible commands, deterministic safety forces a live state refresh which reveals new queued batch jobs.',
    expected_outcome: 'Stale data flagged (cache delta > 15m). Fresh re-poll prevents disruptive termination.',
    safety_rule: 'Reject actions predicated on observations with timestamp delta > TTL threshold.',
  },
  {
    id: 'failed-action',
    title: 'Scenario D: Simulated Action Failure',
    category: 'Fault Resilience',
    target_service_id: 'data-pipeline',
    description:
      'Agent requests workload resize on data pipeline. Cloud infrastructure simulator injects an API timeout / hypervisor quota failure.',
    expected_outcome: 'Deterministic engine intercepts failure, verifies infrastructure untouched, triggers fallback rollback explanation.',
    safety_rule: 'Post-action verification step confirms state matches desired target before declaring success.',
  },
];

const MOCK_INVESTIGATIONS = {
  'cost-optimization': {
    scenario_id: 'cost-optimization',
    scenario_title: 'Scenario A: Cost Optimization',
    target_service_id: 'reports-worker',
    agent_status: 'decision_ready',
    summary: 'Autonomous agent identified sustained idle capacity in reports-worker. Recommends safe scale-down from 4 to 1 instance.',
    final_decision: {
      action: 'scale_down',
      target_service: 'reports-worker',
      current_instances: 4,
      target_instances: 1,
      min_instances: 1,
      status: 'ready_for_safety_check',
      estimated_savings_hourly: 0.72,
      estimated_savings_monthly: 525.60,
      reasoning: 'Utilization has remained below 15% for >45m with negligible request traffic (3.2 RPS). Downscaling to 1 instance complies with min capacity bounds (min: 1) and will yield 75% cost reduction without SLA impact.'
    },
    steps: [
      {
        step_id: 'step-01',
        timestamp: '14:32:01',
        status: 'completed',
        title: 'Optimization Request Received',
        description: 'FinOps anomaly detection triggered scheduled resource cost evaluation across all active clusters.',
        tool_called: 'cost_anomaly_detector',
        observation: 'reports-worker accounts for $0.96/hr with low observed traffic throughput.',
        evidence_chips: ['Cost: $0.96/hr', 'Instances: 4', 'Min Cap: 1', 'Cluster: SIM-EAST-1']
      },
      {
        step_id: 'step-02',
        timestamp: '14:32:04',
        status: 'completed',
        title: 'Fleet State & Metric Inspection',
        description: 'Queried Cloud Simulator metrics API for 60-minute utilization telemetry.',
        tool_called: 'get_service_metrics',
        observation: 'CPU utilization consistently flat at 12%, memory at 28%, ingress traffic at 3.2 RPS.',
        evidence_chips: ['CPU: 12%', 'MEM: 28%', 'RPS: 3.2', 'Latency: 145ms']
      },
      {
        step_id: 'step-03',
        timestamp: '14:32:07',
        status: 'completed',
        title: 'Telemetry Freshness & Drift Check',
        description: 'Verified cache timestamp freshness and evaluated temporal trend for impending workload spikes.',
        tool_called: 'verify_telemetry_freshness',
        observation: 'Telemetry cache age is 12 seconds (< 60s TTL). No scheduled cron batch jobs registered for the next 4 hours.',
        evidence_chips: ['Cache Age: 12s', 'Freshness: VALID', 'Scheduled Jobs: 0']
      },
      {
        step_id: 'step-04',
        timestamp: '14:32:10',
        status: 'completed',
        title: 'Idle Capacity Identification',
        description: 'Evaluated observed load against instance sizing thresholds. Confirmed 3 excess instances.',
        tool_called: 'capacity_analyzer',
        observation: '1 instance of c6g.large can easily absorb up to 40 RPS at current report complexity.',
        evidence_chips: ['Sustained Idle: 48m', 'Current: 4 inst', 'Target: 1 inst', 'Excess: 3 inst']
      },
      {
        step_id: 'step-05',
        timestamp: '14:32:14',
        status: 'completed',
        title: 'Decision Formulated',
        description: 'Agent synthesized findings and generated candidate scale-down action for deterministic validation.',
        tool_called: 'decision_engine',
        observation: 'Proposed Action: scale_down reports-worker (4 -> 1 instance). Projected savings: $0.72/hr ($525.60/mo).',
        evidence_chips: ['Action: scale_down', 'Delta: -3 instances', 'Savings: $525.60/mo', 'Status: Ready']
      }
    ]
  },

  'rising-traffic': {
    scenario_id: 'rising-traffic',
    scenario_title: 'Scenario B: Rising Traffic Surge',
    target_service_id: 'api-gateway',
    agent_status: 'decision_ready',
    summary: 'Agent investigated api-gateway cost-cutting opportunity but vetoed downscaling due to active traffic surge and latency escalation.',
    final_decision: {
      action: 'preserve_capacity',
      target_service: 'api-gateway',
      current_instances: 6,
      target_instances: 6,
      min_instances: 3,
      status: 'ready_for_safety_check',
      estimated_savings_hourly: 0.00,
      estimated_savings_monthly: 0.00,
      reasoning: 'Traffic has surged by 45% in 15 minutes, pushing CPU to 74% and p95 latency to 38ms. Aggressive cost-cutting must be blocked to prevent SLA violations.'
    },
    steps: [
      {
        step_id: 'step-01',
        timestamp: '14:35:10',
        status: 'completed',
        title: 'FinOps Review Triggered',
        description: 'Periodic cost auditor flagged api-gateway as highest hourly cost contributor ($1.80/hr).',
        tool_called: 'cost_anomaly_detector',
        observation: 'api-gateway running 6 c6g.xlarge instances. Candidate for instance right-sizing review.',
        evidence_chips: ['Cost: $1.80/hr', 'Instances: 6', 'Min: 3', 'Max: 12']
      },
      {
        step_id: 'step-02',
        timestamp: '14:35:13',
        status: 'completed',
        title: 'Real-Time Ingress Telemetry Probe',
        description: 'Queried load balancer metrics for instantaneous request rates and error counts.',
        tool_called: 'get_service_metrics',
        observation: 'Traffic surge detected: RPS increased from 850 to 1420.5 req/sec over past 15 minutes.',
        evidence_chips: ['RPS: 1420.5', 'Surge: +45%', 'CPU: 74%', 'Trend: ASCENDING']
      },
      {
        step_id: 'step-03',
        timestamp: '14:35:17',
        status: 'warning',
        title: 'SLA Latency Constraint Evaluation',
        description: 'Evaluated p95 latency against corporate SLA threshold (SLA target: < 40ms).',
        tool_called: 'evaluate_sla_constraints',
        observation: 'Latency has crept from 22ms up to 38ms. Headroom before SLA breach is under 2ms.',
        evidence_chips: ['P95: 38ms', 'SLA Limit: 40ms', 'Headroom: 2ms', 'Risk: HIGH']
      },
      {
        step_id: 'step-04',
        timestamp: '14:35:21',
        status: 'rejected',
        title: 'Cost Downscaling Rejected by Agent',
        description: 'Agent reasoning engine explicitly vetoed cost reduction recommendation.',
        tool_called: 'safety_policy_evaluator',
        observation: 'Downscaling by even 1 instance would induce queue saturation and breach the 40ms latency SLA.',
        evidence_chips: ['Downscale: VETOED', 'Cost Optimization: HALTED', 'Reliability Priority: ACTIVE']
      },
      {
        step_id: 'step-05',
        timestamp: '14:35:25',
        status: 'completed',
        title: 'Decision Formulated',
        description: 'Agent concluded investigation with recommendation to preserve capacity or buffer scale-up.',
        tool_called: 'decision_engine',
        observation: 'Decision: Maintain all 6 instances. Recommended autoscaling trigger to 8 instances if RPS exceeds 1500.',
        evidence_chips: ['Action: preserve_capacity', 'Instances: 6', 'SLA Preserved', 'Status: Ready']
      }
    ]
  },

  'stale-observation': {
    scenario_id: 'stale-observation',
    scenario_title: 'Scenario C: Stale Observation Re-check',
    target_service_id: 'reports-worker',
    agent_status: 'decision_ready',
    summary: 'Agent intercepted a 32-minute-old cached observation showing idle load. Deterministic freshness guard forced live re-poll which caught incoming workload.',
    final_decision: {
      action: 'abort_downscale',
      target_service: 'reports-worker',
      current_instances: 4,
      target_instances: 4,
      min_instances: 1,
      status: 'ready_for_safety_check',
      estimated_savings_hourly: 0.00,
      estimated_savings_monthly: 0.00,
      reasoning: 'Cached telemetry was 32m old (TTL: 15m). Live hypervisor probe revealed urgent quarter-end batch reports just entered queue (CPU 68%). Stale downscale aborted.'
    },
    steps: [
      {
        step_id: 'step-01',
        timestamp: '14:40:02',
        status: 'completed',
        title: 'Cached Optimization Request',
        description: 'Optimizer received scheduled job recommendation based on telemetry snapshot.',
        tool_called: 'cache_reader',
        observation: 'Cached telemetry report indicated reports-worker at 0 RPS and 8% CPU.',
        evidence_chips: ['Snapshot CPU: 8%', 'Snapshot RPS: 0', 'Cache Key: snap_rw_1408']
      },
      {
        step_id: 'step-02',
        timestamp: '14:40:05',
        status: 'warning',
        title: 'Telemetry Freshness Verification',
        description: 'Agent inspected metadata headers and timestamp delta of the telemetry payload.',
        tool_called: 'verify_telemetry_freshness',
        observation: 'Observation timestamp was 14:08:00 (Age: 32m 05s). Telemetry freshness TTL is 15 minutes.',
        evidence_chips: ['Observation Age: 32m', 'TTL: 15m', 'Delta: +17m Stale', 'Flag: OUTDATED']
      },
      {
        step_id: 'step-03',
        timestamp: '14:40:08',
        status: 'rejected',
        title: 'Stale Evidence Rejected',
        description: 'Agent refused to evaluate downscale on stale evidence; enforced freshness safety policy.',
        tool_called: 'safety_policy_evaluator',
        observation: 'Policy VIOLATION: Cannot execute state mutation based on expired telemetry cache.',
        evidence_chips: ['Cache: REJECTED', 'Action Blocked', 'Fresh Probe: REQUIRED']
      },
      {
        step_id: 'step-04',
        timestamp: '14:40:12',
        status: 'completed',
        title: 'Live Hypervisor Re-Poll',
        description: 'Bypassed cache and performed synchronous live probe directly against simulated cloud simulator.',
        tool_called: 'get_service_metrics',
        observation: 'Actual current state reveals CPU jumped to 68%, 24 batch jobs in queue, memory at 62%.',
        evidence_chips: ['Live CPU: 68%', 'Live MEM: 62%', 'Queued Jobs: 24', 'Status: BUSY']
      },
      {
        step_id: 'step-05',
        timestamp: '14:40:16',
        status: 'completed',
        title: 'Updated Decision Formulated',
        description: 'Agent re-reasoned with verified fresh telemetry and reversed previous downscale intent.',
        tool_called: 'decision_engine',
        observation: 'Decision: Abort downscale. Preserve 4 instances to avoid batch job queue backlog.',
        evidence_chips: ['Action: abort_downscale', 'Instances: 4', 'Risk Prevented: Disruption', 'Status: Ready']
      }
    ]
  },

  'failed-action': {
    scenario_id: 'failed-action',
    scenario_title: 'Scenario D: Simulated Action Failure',
    target_service_id: 'data-pipeline',
    agent_status: 'action_failed',
    summary: 'Agent attempted memory resize on data-pipeline. Infrastructure simulator failed execution; agent verified state integrity and logged incident.',
    final_decision: {
      action: 'resize_workload',
      target_service: 'data-pipeline',
      current_instances: 3,
      target_instances: 4,
      min_instances: 2,
      status: 'execution_failed',
      estimated_savings_hourly: 0.00,
      estimated_savings_monthly: 0.00,
      reasoning: 'Memory reached 83% threshold. Scale/resize action failed at cloud provider layer (Quota Exceeded). Infrastructure remained intact at 3 instances.'
    },
    steps: [
      {
        step_id: 'step-01',
        timestamp: '14:44:01',
        status: 'completed',
        title: 'Memory Anomaly Detected',
        description: 'Monitoring daemon reported analytics streaming ingestion memory sustained at 83%.',
        tool_called: 'telemetry_monitor',
        observation: 'data-pipeline memory consumption exceeded 80% watermark for 20 consecutive minutes.',
        evidence_chips: ['MEM: 83%', 'Threshold: 80%', 'Instances: 3', 'Type: r6g.large']
      },
      {
        step_id: 'step-02',
        timestamp: '14:44:05',
        status: 'completed',
        title: 'Candidate Action Proposed',
        description: 'Agent proposed scaling from 3 to 4 instances to distribute Kafka partition ingestion load.',
        tool_called: 'capacity_planner',
        observation: 'Adding 1 instance drops average memory utilization to ~62%, safely below alert threshold.',
        evidence_chips: ['Proposed: 3 -> 4 inst', 'Target Cost: $1.60/hr', 'Memory Target: 62%']
      },
      {
        step_id: 'step-03',
        timestamp: '14:44:08',
        status: 'completed',
        title: 'Deterministic Safety Engine Pass',
        description: 'Backend safety engine verified bounds: target 4 is within max bounds (max: 8, min: 2).',
        tool_called: 'safety_engine_validator',
        observation: 'All safety constraints satisfied. Action authorized for dispatch.',
        evidence_chips: ['Min: 2', 'Max: 8', 'Target: 4', 'Verdict: APPROVED']
      },
      {
        step_id: 'step-04',
        timestamp: '14:44:12',
        status: 'failed',
        title: 'Cloud Infrastructure Action Failed',
        description: 'Cloud provider API returned unexpected hypervisor allocation error during instance boot.',
        tool_called: 'cloud_action_dispatcher',
        observation: 'PROVIDER ERROR: 503 Service Unavailable — InsufficientInstanceCapacity in AZ sim-east-1a.',
        evidence_chips: ['Error: 503 Quota', 'AZ: sim-east-1a', 'Exit Code: 1', 'Execution: FAILED']
      },
      {
        step_id: 'step-05',
        timestamp: '14:44:16',
        status: 'completed',
        title: 'Post-Action State Verification',
        description: 'Agent immediately audited cloud state to verify infrastructure did not enter half-provisioned state.',
        tool_called: 'verify_cloud_state',
        observation: 'Audit confirmed: 3 instances remain healthy. No zombie or broken containers present.',
        evidence_chips: ['Verified State: 3 inst', 'Integrity: UNCORRUPTED', 'Status: STABLE']
      },
      {
        step_id: 'step-06',
        timestamp: '14:44:20',
        status: 'completed',
        title: 'Incident Explanation & Fallback',
        description: 'Agent logged infrastructure failure to audit ledger and escalated cloud capacity alert to DevOps.',
        tool_called: 'incident_logger',
        observation: 'Incident logged. Fallback: retain current 3 instances and schedule retry in alternative AZ (sim-east-1b).',
        evidence_chips: ['Incident ID: INC-8821', 'Fallback: Standby', 'State: PRESERVED']
      }
    ]
  }
};

const MOCK_SAFETY_VALIDATIONS = {
  'cost-optimization': {
    scenario_id: 'cost-optimization',
    target_service_id: 'reports-worker',
    verdict: 'SAFE TO EXECUTE',
    verdict_status: 'pass',
    policy_id: 'POL-FINOPS-DOWN-01',
    timestamp: '14:32:18',
    summary: 'All deterministic boundary limits, health guards, freshness constraints, and traffic trends validated. Proposed scale down authorized.',
    checks: [
      {
        id: 'min_capacity',
        name: 'Minimum Capacity Constraint',
        observed: 'Target: 1 instance',
        rule: 'Min allowed: 1 instance',
        status: 'PASS'
      },
      {
        id: 'max_capacity',
        name: 'Maximum Capacity Bound',
        observed: 'Target: 1 instance',
        rule: 'Max bound: 8 instances',
        status: 'PASS'
      },
      {
        id: 'service_health',
        name: 'Service Health Guard',
        observed: 'reports-worker: HEALTHY',
        rule: 'Must not be in DEGRADED status',
        status: 'PASS'
      },
      {
        id: 'telemetry_freshness',
        name: 'Telemetry Freshness TTL',
        observed: 'Age: 12 seconds',
        rule: 'TTL threshold: < 900 seconds (15m)',
        status: 'PASS'
      },
      {
        id: 'sla_latency',
        name: 'SLA / Latency Guard',
        observed: 'P95: 145ms',
        rule: 'Target SLA limit: < 200ms',
        status: 'PASS'
      },
      {
        id: 'traffic_surge',
        name: 'Capacity / Traffic Surge Guard',
        observed: 'RPS: 3.2 req/sec',
        rule: 'No upward surge detected (> 20% in 15m)',
        status: 'PASS'
      }
    ]
  },

  'rising-traffic': {
    scenario_id: 'rising-traffic',
    target_service_id: 'api-gateway',
    verdict: 'BLOCKED BY SAFETY POLICY',
    verdict_status: 'blocked',
    policy_id: 'POL-CAPACITY-PROTECT-04',
    timestamp: '14:35:23',
    summary: 'SLA latency margin and ascending ingress traffic trip deterministic safety guardrails. Premature downscaling explicitly prohibited.',
    checks: [
      {
        id: 'min_capacity',
        name: 'Minimum Capacity Constraint',
        observed: 'Current: 6 instances',
        rule: 'Min allowed: 3 instances',
        status: 'PASS'
      },
      {
        id: 'max_capacity',
        name: 'Maximum Capacity Bound',
        observed: 'Current: 6 instances',
        rule: 'Max bound: 12 instances',
        status: 'PASS'
      },
      {
        id: 'service_health',
        name: 'Service Health Guard',
        observed: 'api-gateway: HEALTHY',
        rule: 'Must not be in DEGRADED status',
        status: 'PASS'
      },
      {
        id: 'telemetry_freshness',
        name: 'Telemetry Freshness TTL',
        observed: 'Age: 8 seconds',
        rule: 'TTL threshold: < 900 seconds (15m)',
        status: 'PASS'
      },
      {
        id: 'sla_latency',
        name: 'SLA / Latency Guard',
        observed: 'P95: 38ms (Limit: 40ms)',
        rule: 'SLA margin buffer >= 5ms required',
        status: 'BLOCKED'
      },
      {
        id: 'traffic_surge',
        name: 'Capacity / Traffic Surge Guard',
        observed: 'RPS: 1420.5 (+45% in 15m)',
        rule: 'Prohibit scale-down if traffic is surging',
        status: 'BLOCKED'
      }
    ]
  },

  'stale-observation': {
    scenario_id: 'stale-observation',
    target_service_id: 'reports-worker',
    verdict: 'BLOCKED BY FRESHNESS GUARD',
    verdict_status: 'blocked',
    policy_id: 'POL-FRESHNESS-TTL-02',
    timestamp: '14:40:07',
    summary: 'Telemetry cache age exceeded maximum allowable TTL (32m > 15m). Live hypervisor probe detected 24 queued batch jobs; stale downscale blocked.',
    checks: [
      {
        id: 'min_capacity',
        name: 'Minimum Capacity Constraint',
        observed: 'Current: 4 instances',
        rule: 'Min allowed: 1 instance',
        status: 'PASS'
      },
      {
        id: 'service_health',
        name: 'Service Health Guard',
        observed: 'reports-worker: HEALTHY',
        rule: 'Must not be in DEGRADED status',
        status: 'PASS'
      },
      {
        id: 'telemetry_freshness',
        name: 'Telemetry Freshness TTL',
        observed: 'Cache Age: 32m 05s (TTL: 15m)',
        rule: 'Reject state mutations on expired cache',
        status: 'BLOCKED'
      },
      {
        id: 'fresh_telemetry_probe',
        name: 'Live Hypervisor Re-probe',
        observed: 'Live state: 24 active batch jobs',
        rule: 'Fresh probe mandatory on TTL breach',
        status: 'PASS'
      },
      {
        id: 'workload_demand_guard',
        name: 'Workload Demand Guard',
        observed: 'Live CPU: 68% (Queue busy)',
        rule: 'Must abort downscale if backlog pending',
        status: 'BLOCKED'
      },
      {
        id: 'action_authorization',
        name: 'Action Execution Authorization',
        observed: 'Stale intent vetoed',
        rule: 'Require confirmed fresh baseline',
        status: 'BLOCKED'
      }
    ]
  },

  'failed-action': {
    scenario_id: 'failed-action',
    target_service_id: 'data-pipeline',
    verdict: 'SAFE TO EXECUTE',
    verdict_status: 'pass',
    policy_id: 'POL-MEMORY-SCALE-03',
    timestamp: '14:44:09',
    summary: 'Parameters verified against quota rules and minimum/maximum instance constraints. Action authorized for dispatch.',
    checks: [
      {
        id: 'min_capacity',
        name: 'Minimum Capacity Constraint',
        observed: 'Target: 4 instances',
        rule: 'Min allowed: 2 instances',
        status: 'PASS'
      },
      {
        id: 'max_capacity',
        name: 'Maximum Capacity Bound',
        observed: 'Target: 4 instances',
        rule: 'Max bound: 8 instances',
        status: 'PASS'
      },
      {
        id: 'service_health',
        name: 'Service Health Guard',
        observed: 'data-pipeline: WARNING (High Mem)',
        rule: 'Proactive remediation authorized',
        status: 'PASS'
      },
      {
        id: 'telemetry_freshness',
        name: 'Telemetry Freshness TTL',
        observed: 'Age: 15 seconds',
        rule: 'TTL threshold: < 900 seconds (15m)',
        status: 'PASS'
      },
      {
        id: 'memory_threshold',
        name: 'Memory Watermark Guard',
        observed: 'Observed: 83% (> 80% limit)',
        rule: 'Scale up required to relieve partition buffer',
        status: 'PASS'
      },
      {
        id: 'concurrency_lock',
        name: 'Cluster Mutation Lock',
        observed: 'No conflicting in-flight actions',
        rule: 'Single active mutation per cluster',
        status: 'PASS'
      }
    ]
  }
};

const MOCK_ACTION_STATUSES = {
  'cost-optimization': {
    action_id: 'ACT-8812',
    service_id: 'reports-worker',
    action_type: 'scale_down',
    display_action: 'SCALE DOWN',
    previous_instances: 4,
    target_instances: 1,
    current_instances: 1,
    status: 'successful',
    status_label: 'ACTION SUCCESSFUL',
    timestamp: '14:32:22',
    reason: 'Sustained underutilization detected (<15% for 45m). Safe scale-down from 4 to 1 instance.',
    error: null,
    rejection_reason: null,
    execution_duration_ms: 1240
  },

  'rising-traffic': {
    action_id: 'ACT-8815',
    service_id: 'api-gateway',
    action_type: 'preserve_capacity',
    display_action: 'CAPACITY PRESERVED',
    previous_instances: 6,
    target_instances: 6,
    current_instances: 6,
    status: 'rejected',
    status_label: 'ACTION REJECTED',
    timestamp: '14:35:26',
    reason: 'Cost optimization downscale rejected by deterministic safety engine.',
    error: null,
    rejection_reason: 'POLICY VETO: Traffic surge (+45%) & Latency margin (38ms / 40ms ceiling) tripped safety guard. Zero instances removed.',
    execution_duration_ms: 0
  },

  'stale-observation': {
    action_id: 'ACT-8819',
    service_id: 'reports-worker',
    action_type: 'abort_downscale',
    display_action: 'NO ACTION / ABORTED',
    previous_instances: 4,
    target_instances: 4,
    current_instances: 4,
    status: 'rejected',
    status_label: 'ACTION REJECTED',
    timestamp: '14:40:18',
    reason: 'Downscale action aborted due to stale telemetry cache and fresh batch queue arrival.',
    error: null,
    rejection_reason: 'FRESHNESS VETO: Cached observation (32m old) invalidated by live probe (24 active batch jobs, CPU 68%). Downscale cancelled.',
    execution_duration_ms: 0
  },

  'failed-action': {
    action_id: 'ACT-8824',
    service_id: 'data-pipeline',
    action_type: 'scale_up',
    display_action: 'SCALE UP',
    previous_instances: 3,
    target_instances: 4,
    current_instances: 3,
    status: 'failed',
    status_label: 'ACTION FAILED',
    timestamp: '14:44:14',
    reason: 'Scale up from 3 to 4 instances dispatched to simulated cloud hypervisor.',
    error: 'CLOUD_API_ERROR: 503 Service Unavailable — InsufficientInstanceCapacity in AZ sim-east-1a.',
    rejection_reason: null,
    execution_duration_ms: 3410
  }
};

const MOCK_VERIFICATIONS = {
  'cost-optimization': {
    verification_id: 'VER-9901',
    service_id: 'reports-worker',
    verdict: 'VERIFIED',
    verdict_status: 'verified',
    timestamp: '14:32:28',
    summary: 'Post-action telemetry re-poll confirms reports-worker stabilized at 1 instance with healthy response metrics.',
    before_after: {
      instances: { label: 'Instances', before: '4', after: '1', unit: 'inst' },
      cpu: { label: 'CPU Utilization', before: '12%', after: '31%', unit: '%' },
      memory: { label: 'Memory Utilization', before: '28%', after: '34%', unit: '%' },
      rps: { label: 'Request Rate', before: '3.2', after: '3.1', unit: 'req/s' },
      latency: { label: 'P95 Latency', before: '145ms', after: '152ms', unit: 'ms' },
      cost: { label: 'Hourly Cost', before: '$0.96', after: '$0.24', unit: '$/hr' }
    },
    checks: [
      { name: 'Target instance count confirmed', status: 'PASS', detail: '1 instance running in hypervisor' },
      { name: 'Service health stable', status: 'PASS', detail: 'Health check probe returning HTTP 200' },
      { name: 'Telemetry re-polled', status: 'PASS', detail: 'Fresh telemetry stream verified at 14:32:27' },
      { name: 'No unexpected capacity regression', status: 'PASS', detail: 'Error rate 0.0%, queue depth 0' }
    ]
  },

  'rising-traffic': {
    verification_id: 'VER-9904',
    service_id: 'api-gateway',
    verdict: 'SAFEGUARD VERIFIED',
    verdict_status: 'verified',
    timestamp: '14:35:30',
    summary: 'Audit verified zero state mutations occurred. Full 6-instance capacity preserved to absorb ongoing surge.',
    before_after: {
      instances: { label: 'Instances', before: '6', after: '6', unit: 'inst' },
      cpu: { label: 'CPU Utilization', before: '74%', after: '74%', unit: '%' },
      memory: { label: 'Memory Utilization', before: '68%', after: '68%', unit: '%' },
      rps: { label: 'Request Rate', before: '1420.5', after: '1420.5', unit: 'req/s' },
      latency: { label: 'P95 Latency', before: '38ms', after: '38ms', unit: 'ms' },
      cost: { label: 'Hourly Cost', before: '$1.80', after: '$1.80', unit: '$/hr' }
    },
    checks: [
      { name: 'Capacity preservation confirmed', status: 'PASS', detail: 'All 6 instances continue handling ingress' },
      { name: 'No unauthorized scale-down occurred', status: 'PASS', detail: 'State audit confirmed zero deletions' },
      { name: 'SLA latency protected', status: 'PASS', detail: 'P95 maintained at 38ms (< 40ms SLA)' },
      { name: 'Autoscaling trigger armed', status: 'PASS', detail: 'Threshold armed to buffer up to 8 inst if needed' }
    ]
  },

  'stale-observation': {
    verification_id: 'VER-9908',
    service_id: 'reports-worker',
    verdict: 'STALE ACTION PREVENTED',
    verdict_status: 'verified',
    timestamp: '14:40:22',
    summary: 'Verification confirms stale action was successfully prevented. Cluster maintained at 4 instances for batch processing.',
    before_after: {
      instances: { label: 'Instances', before: '4', after: '4', unit: 'inst' },
      cpu: { label: 'CPU Utilization', before: '12% (stale)', after: '68% (live)', unit: '%' },
      memory: { label: 'Memory Utilization', before: '28%', after: '62%', unit: '%' },
      rps: { label: 'Request Rate', before: '3.2', after: '18.4', unit: 'req/s' },
      latency: { label: 'P95 Latency', before: '145ms', after: '148ms', unit: 'ms' },
      cost: { label: 'Hourly Cost', before: '$0.96', after: '$0.96', unit: '$/hr' }
    },
    checks: [
      { name: 'Stale state mutation prevented', status: 'PASS', detail: 'Zero destructive actions issued' },
      { name: 'Live batch processing preserved', status: 'PASS', detail: 'All 24 queued jobs actively computing' },
      { name: 'Live telemetry stream established', status: 'PASS', detail: 'Telemetry age now 3s (< 15m TTL)' },
      { name: 'Service health verified', status: 'PASS', detail: 'reports-worker running at normal queue throughput' }
    ]
  },

  'failed-action': {
    verification_id: 'VER-9912',
    service_id: 'data-pipeline',
    verdict: 'RECOVERY VERIFIED',
    verdict_status: 'recovery_verified',
    timestamp: '14:44:18',
    summary: 'Post-failure audit verified cloud infrastructure remained in uncorrupted state. Instance count unchanged at 3.',
    before_after: {
      instances: { label: 'Instances', before: '3', after: '3', unit: 'inst' },
      cpu: { label: 'CPU Utilization', before: '58%', after: '58%', unit: '%' },
      memory: { label: 'Memory Utilization', before: '83%', after: '83%', unit: '%' },
      rps: { label: 'Request Rate', before: '820.0', after: '820.0', unit: 'req/s' },
      latency: { label: 'P95 Latency', before: '95ms', after: '95ms', unit: 'ms' },
      cost: { label: 'Hourly Cost', before: '$1.20', after: '$1.20', unit: '$/hr' }
    },
    checks: [
      { name: 'Infrastructure state intact', status: 'PASS', detail: '3 instances verified running in hypervisor' },
      { name: 'Instance count unchanged', status: 'PASS', detail: 'Desired: 3, Actual: 3 (No mutation)' },
      { name: 'Service remains healthy', status: 'PASS', detail: 'Kafka consumer offsets committing normally' },
      { name: 'Zero orphan containers detected', status: 'PASS', detail: 'Hypervisor cleanup confirmed complete' }
    ]
  }
};

const MOCK_COST_IMPACTS = {
  'cost-optimization': {
    scenario_id: 'cost-optimization',
    service_id: 'reports-worker',
    previous_hourly_cost: 0.96,
    new_hourly_cost: 0.24,
    hourly_delta: -0.72,
    previous_monthly_spend: 700.80,
    new_monthly_spend: 175.20,
    estimated_monthly_savings: 525.60,
    verified_status: 'CONFIRMED AFTER VERIFICATION',
    status_type: 'savings_confirmed',
    verified: true,
    summary: 'Verified post-action downscale delivers $0.72/hr net reduction ($525.60/mo) without degrading service SLA.'
  },

  'rising-traffic': {
    scenario_id: 'rising-traffic',
    service_id: 'api-gateway',
    previous_hourly_cost: 1.80,
    new_hourly_cost: 1.80,
    hourly_delta: 0.00,
    previous_monthly_spend: 1314.00,
    new_monthly_spend: 1314.00,
    estimated_monthly_savings: 0.00,
    verified_status: 'CAPACITY PROTECTED (SLA PRESERVED OVER COST CUT)',
    status_type: 'capacity_protected',
    verified: true,
    summary: 'Cost cut deliberately avoided. Preserving $1.80/hr run-rate prevents latency degradation and potential SLA penalties.'
  },

  'stale-observation': {
    scenario_id: 'stale-observation',
    service_id: 'reports-worker',
    previous_hourly_cost: 0.96,
    new_hourly_cost: 0.96,
    hourly_delta: 0.00,
    previous_monthly_spend: 700.80,
    new_monthly_spend: 700.80,
    estimated_monthly_savings: 0.00,
    verified_status: 'OUTAGE AVOIDED (BATCH WORKLOAD PRESERVED)',
    status_type: 'outage_avoided',
    verified: true,
    summary: 'Rejecting stale telemetry avoided severe worker starvation for incoming quarter-end batch reporting.'
  },

  'failed-action': {
    scenario_id: 'failed-action',
    service_id: 'data-pipeline',
    previous_hourly_cost: 1.20,
    new_hourly_cost: 1.20,
    hourly_delta: 0.00,
    previous_monthly_spend: 876.00,
    new_monthly_spend: 876.00,
    estimated_monthly_savings: 0.00,
    verified_status: 'ZERO UNAUTHORIZED SPEND (FAIL-SAFE ROLLBACK)',
    status_type: 'rollback_verified',
    verified: true,
    summary: 'Provider hypervisor failure safely contained. State verified unchanged with zero billing corruption.'
  }
};

export const mockApi = {
  /**
   * Fetch aggregated cloud spend summary and health metrics
   */
  getCostSummary: () => {
    const totalHourlyBurn = MOCK_SERVICES.reduce((acc, s) => acc + s.cost_per_hour, 0);
    const projectedMonthlySpend = totalHourlyBurn * 730; // 730 hours in average month
    const totalInstances = MOCK_SERVICES.reduce((acc, s) => acc + s.current_instances, 0);
    const healthyCount = MOCK_SERVICES.filter((s) => s.health === 'healthy').length;
    const warningCount = MOCK_SERVICES.filter((s) => s.health === 'warning').length;

    const costBreakdown = MOCK_SERVICES.map((s) => ({
      service_id: s.service_id,
      name: s.name,
      hourly_cost: s.cost_per_hour,
      monthly_projected: +(s.cost_per_hour * 730).toFixed(2),
      percentage_of_total: +((s.cost_per_hour / totalHourlyBurn) * 100).toFixed(1),
    })).sort((a, b) => b.hourly_cost - a.hourly_cost);

    return {
      total_hourly_burn: +totalHourlyBurn.toFixed(2),
      projected_monthly_spend: +projectedMonthlySpend.toFixed(2),
      savings_realized_monthly: 432.0, // Historical FinOps savings this billing cycle
      savings_realized_hourly: 0.59,
      total_instances: totalInstances,
      service_count: MOCK_SERVICES.length,
      health_summary: {
        healthy: healthyCount,
        warning: warningCount,
        degraded: 0,
      },
      cost_breakdown: costBreakdown,
    };
  },

  /**
   * Fetch list of all active monitored cloud services
   */
  getServices: () => {
    return MOCK_SERVICES.map((s) => ({
      service_id: s.service_id,
      name: s.name,
      description: s.description,
      health: s.health,
      status_label: s.status_label,
      current_instances: s.current_instances,
      min_instances: s.min_instances,
      max_instances: s.max_instances,
      cost_per_hour: s.cost_per_hour,
      instance_type: s.instance_type,
      cpu_utilization: s.cpu_utilization,
      memory_utilization: s.memory_utilization,
      traffic_rps: s.traffic_rps,
      latency_ms: s.latency_ms,
      alerts: s.alerts,
    }));
  },

  /**
   * Fetch detailed metrics telemetry for a single service
   */
  getServiceMetrics: (serviceId) => {
    const service = MOCK_SERVICES.find((s) => s.service_id === serviceId);
    if (!service) {
      return null;
    }
    return {
      service_id: service.service_id,
      name: service.name,
      instance_type: service.instance_type,
      current_instances: service.current_instances,
      min_instances: service.min_instances,
      max_instances: service.max_instances,
      cost_per_hour: service.cost_per_hour,
      cpu_utilization: service.cpu_utilization,
      memory_utilization: service.memory_utilization,
      traffic_rps: service.traffic_rps,
      latency_ms: service.latency_ms,
      metrics_history: service.metrics_history,
      alerts: service.alerts,
    };
  },

  /**
   * Fetch the 4 official hackathon evaluation scenarios
   */
  getScenarios: () => {
    return MOCK_SCENARIOS;
  },

  /**
   * Fetch the autonomous agent investigation audit trail for a scenario
   */
  getInvestigation: (scenarioId) => {
    return MOCK_INVESTIGATIONS[scenarioId] || MOCK_INVESTIGATIONS['cost-optimization'];
  },

  /**
   * Fetch deterministic safety engine validation results
   */
  getSafetyValidation: (scenarioId) => {
    return MOCK_SAFETY_VALIDATIONS[scenarioId] || MOCK_SAFETY_VALIDATIONS['cost-optimization'];
  },

  /**
   * Fetch cloud action execution status
   */
  getActionStatus: (scenarioId) => {
    return MOCK_ACTION_STATUSES[scenarioId] || MOCK_ACTION_STATUSES['cost-optimization'];
  },

  /**
   * Fetch post-action state verification results
   */
  getVerification: (scenarioId) => {
    return MOCK_VERIFICATIONS[scenarioId] || MOCK_VERIFICATIONS['cost-optimization'];
  },

  /**
   * Fetch financial cost impact and verified savings
   */
  getCostImpact: (scenarioId) => {
    return MOCK_COST_IMPACTS[scenarioId] || MOCK_COST_IMPACTS['cost-optimization'];
  },
};


