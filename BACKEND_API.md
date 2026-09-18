# Backend & Cloud Simulator API Documentation

**Author:** Laksh (Backend + Cloud Simulator + Deterministic Safety Layer)  
**Branch:** `laksh-backend`  
**Base URL:** `http://localhost:8000`  
**Interactive Docs:** `http://localhost:8000/docs`

---

## 1. Quick Start

### Install & Run
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --port 8000 --reload
```

### Run Tests
```bash
python -m pytest -v
```

---

## 2. Core Architecture & Safety Principle

```
           Manoj's AI Agent / Rakshita's UI
                          │
                   POST /api/actions
                          │
                          ▼
            ┌───────────────────────────┐
            │ Deterministic Safety      │
            │ Validation Engine         │
            └─────────────┬─────────────┘
                          │
             ┌────────────┴────────────┐
             │                         │
     [Passes Checks]             [Safety Breach]
             │                         │
             ▼                         ▼
   ┌───────────────────┐     ┌───────────────────┐
   │ Cloud Simulator   │     │ Record Rejection  │
   │ Executes Action   │     │ State Unchanged   │
   └─────────┬─────────┘     └─────────┬─────────┘
             │                         │
             ▼                         ▼
   Status: "success"         Status: "rejected"
   (or "failed" in Sim)
             │
             ▼
    GET /api/actions/{action_id}/verify
```

> [!IMPORTANT]
> **Deterministic Backend Authority**: Every action requested by the AI agent is validated by deterministic code rules before execution. Even if an LLM hallucinates an unsafe action (e.g. scaling down a struggling service or breaching min instances), the backend rejects it deterministically.

---

## 3. Endpoints for Manoj (AI Agent Investigation & Execution)

### List Services
```http
GET /api/services
```
**Response:**
```json
{
  "services": [
    {
      "service_id": "reports-worker",
      "name": "Reports Worker",
      "status": "idle",
      "health": "healthy",
      "instances": 4,
      "hourly_cost": 4.20,
      "observed_at": "2026-09-18T08:30:00Z"
    }
  ]
}
```

### Inspect Specific Service
```http
GET /api/services/{service_id}
```

### Get Real-Time Metrics
```http
GET /api/services/{service_id}/metrics
```
**Response:**
```json
{
  "service_id": "reports-worker",
  "cpu_percent": 9.0,
  "memory_percent": 15.0,
  "request_rate": 0.0,
  "latency_ms": 120.0,
  "observed_at": "2026-09-18T08:30:00Z"
}
```

### Get Traffic & Trend
```http
GET /api/services/{service_id}/traffic
```
**Response:**
```json
{
  "service_id": "auth-api",
  "request_rate": 850.0,
  "traffic_trend": "rising",
  "peak_rps": 920.0,
  "error_rate_percent": 0.8,
  "observed_at": "2026-09-18T08:30:00Z"
}
```

### Get Health Status
```http
GET /api/services/{service_id}/health
```
**Response:**
```json
{
  "service_id": "reports-worker",
  "health": "healthy",
  "checks_passing": 5,
  "checks_total": 5,
  "active_alerts": [],
  "observed_at": "2026-09-18T08:30:00Z"
}
```

### Get Simulated Cost Telemetry
```http
GET /api/services/{service_id}/cost
```
**Response:**
```json
{
  "service_id": "reports-worker",
  "instances": 4,
  "cost_per_instance_hour": 1.05,
  "hourly_cost": 4.20,
  "daily_projected_cost": 100.80,
  "monthly_projected_cost": 3024.00,
  "currency": "USD",
  "is_simulated": true,
  "observed_at": "2026-09-18T08:30:00Z"
}
```

### Get Capacity & Guardrail Constraints
```http
GET /api/services/{service_id}/constraints
```
**Response:**
```json
{
  "service_id": "reports-worker",
  "min_instances": 1,
  "max_instances": 10,
  "max_latency_threshold_ms": 250.0,
  "cpu_scale_down_max_percent": 65.0,
  "allow_scale_down_when_rising_traffic": false,
  "max_step_change": 5
}
```

### Inspect Stale Observation (Scenario C)
```http
GET /api/services/{service_id}/stale-observation
```
**Response:**
```json
{
  "service_id": "analytics-pipeline",
  "stale_metrics": {
    "service_id": "analytics-pipeline",
    "cpu_percent": 12.0,
    "memory_percent": 20.0,
    "request_rate": 15.0,
    "latency_ms": 75.0,
    "observed_at": "2026-09-18T07:45:00Z"
  },
  "current_metrics": {
    "service_id": "analytics-pipeline",
    "cpu_percent": 45.0,
    "memory_percent": 55.0,
    "request_rate": 320.0,
    "latency_ms": 180.0,
    "observed_at": "2026-09-18T08:30:00Z"
  },
  "time_delta_seconds": 2700.0,
  "is_stale": true,
  "warning": "Observation timestamp is significantly older than current cloud state. Re-check required before action execution."
}
```

---

## 4. Action API (Execution & Safety Guardrails)

### Propose / Execute Action
```http
POST /api/actions
Content-Type: application/json

{
  "service_id": "reports-worker",
  "action": "scale_down",
  "target_instances": 1,
  "reason": "Service is idle with zero traffic."
}
```

#### Success Response
```json
{
  "action_id": "act-3b1a89c2",
  "status": "success",
  "service_id": "reports-worker",
  "action": "scale_down",
  "previous_instances": 4,
  "new_instances": 1,
  "reason": "Service is idle with zero traffic.",
  "safety_violations": [],
  "execution_error": null
}
```

#### Rejection Response (Safety Guardrail Triggered)
```json
{
  "action_id": "act-a9f821de",
  "status": "rejected",
  "service_id": "reports-worker",
  "action": "scale_down",
  "previous_instances": 4,
  "new_instances": 4,
  "reason": "Safety validation rejected action: Target instances (0) is below configured minimum (1) for service 'reports-worker'.",
  "safety_violations": [
    {
      "rule_name": "MIN_CAPACITY_VIOLATION",
      "message": "Target instances (0) is below configured minimum (1) for service 'reports-worker'."
    }
  ],
  "execution_error": null
}
```

#### Failed Action Response (Scenario D Provider Failure)
```json
{
  "action_id": "act-e11a09cd",
  "status": "failed",
  "service_id": "payment-processor",
  "action": "scale_up",
  "previous_instances": 2,
  "new_instances": 2,
  "reason": null,
  "safety_violations": [],
  "execution_error": "Cloud provider capacity error: requested instance type unavailable in us-east-1a."
}
```

---

## 5. Post-Action Verification Endpoint

```http
GET /api/actions/{action_id}/verify
```

**Response:**
```json
{
  "action_id": "act-3b1a89c2",
  "verified": true,
  "status": "success",
  "service_id": "reports-worker",
  "previous_instances": 4,
  "target_instances": 1,
  "current_instances": 1,
  "cost_before": 4.20,
  "cost_after": 1.05,
  "estimated_hourly_savings": 3.15,
  "current_metrics": {
    "service_id": "reports-worker",
    "cpu_percent": 9.0,
    "memory_percent": 15.0,
    "request_rate": 0.0,
    "latency_ms": 120.0,
    "observed_at": "2026-09-18T08:35:00Z"
  },
  "message": "Action verified: capacity successfully adjusted from 4 to 1 instances as requested."
}
```

---

## 6. Official Test Scenario Controller

```http
POST /api/scenarios/{scenario_name}
```
Supported values:
- `scenario_a` — Cost Optimization: `reports-worker` idle at 4 instances. Safe to scale down to 1 instance.
- `scenario_b` — Rising Traffic: `auth-api` has rising traffic & high latency. Scale-down blocked by safety engine.
- `scenario_c` — Stale Observation: `analytics-pipeline` live state has surged; cached metrics are 45m old.
- `scenario_d` — Failed Action: `payment-processor` simulates provider capacity failure while keeping state consistent.

```http
POST /api/reset
```
Resets all services and actions back to baseline.
