# AI Agent / Decision Engine (`agent/`)

**Owner**: Manoj (AI Agent / Decision Engine Developer)  
**Branch**: `manoj-agent`  
**Role**: Autonomous reasoning, investigation, tool execution, decision generation, post-action verification, and transparent explanation.

---

## 1. Architectural Role & Flow

The AI Agent answers the core question:
> **"What should the AI do next, and why?"**

### Flow Diagram

```
USER NATURAL-LANGUAGE REQUEST / API CALL
           ↓
LLM Natural-Language Understanding (NLU)
  - Identifies target service_id and objective
           ↓
Investigation Planning & Tool Selection
  - Plans queries across state, metrics, traffic, health, constraints, cost
           ↓
Telemetry Gathering & Staleness Detection
  - Executes investigation tools
  - Detects if initial or live telemetry is stale (>300s); triggers fresh re-check
           ↓
Reasoning & Decision Making
  - PRIMARY PATH: LLM structured reasoning with prompt guardrails
  - RELIABILITY FALLBACK: Deterministic rule-based decision engine
           ↓
Action Request Generation
  - Formulates structured ActionRequest (service_id, action, target_instances, reason, safety considerations)
           ↓
[CRITICAL BOUNDARY] Backend Deterministic Safety Layer (Laksh)
  - Validates action against min/max instances, service health, availability
  - Reject / Execute
           ↓
Post-Action State Re-Check
  - Independently re-fetches live state from cloud infrastructure
           ↓
Verification & Discrepancy Detection
  - Verifies whether actual live instances match target state
  - Detects infrastructure failures or discrepancies
           ↓
Final Explanation Generation
  - Generates comprehensive, honest audit report via LLM
```

---

## 2. LLM Integration & Deterministic Safety Boundary

- **Primary Reasoning**: Uses LLM (`GeminiLLM`, `OpenAILLM`, or `LocalSimulatedLLM`) for:
  - Intent understanding from natural language
  - Investigation planning & tool selection
  - Nuanced reasoning over trade-offs (cost vs latency SLOs)
  - Generating structured JSON decisions
  - Human-readable explanation generation
- **Deterministic Reliability Fallback**:
  - If external LLM API keys are unset, or if an API call fails/times out, the agent seamlessly switches to `DeterministicDecisionEngine`.
- **Authoritative Execution Authority**:
  - The deterministic backend safety engine (owned by Laksh) is the **final authority**. The agent proposes actions, but the backend deterministically approves or rejects them.

---

## 3. Official Test Scenarios Supported

1. **Scenario A — Cost Optimization**
   - Service: `reports-worker`
   - Telemetry: Low CPU (8.5%), negligible traffic (1.2 RPS).
   - Agent Action: Reasons underutilization -> proposes `SCALE_DOWN` from 4 to 1 instance -> backend approves -> verifier confirms 1 instance -> explains $216/month savings.

2. **Scenario B — Rising Traffic**
   - Service: `checkout-api`
   - Telemetry: Heavy request load (860 RPS), elevated CPU (84%), p95 latency at 235ms nearing 250ms limit.
   - Agent Action: Refuses cost scale down -> proposes `SCALE_UP` to 5 instances -> protects checkout SLOs.

3. **Scenario C — Stale Observation**
   - Telemetry: Observation passed with 2-hour-old timestamp.
   - Agent Action: Detects staleness -> logs warning -> re-fetches live telemetry -> discovers active service load -> prevents unsafe scale down.

4. **Scenario D — Failed Action**
   - Service: `analytics-stream`
   - Telemetry: Underutilized, requests scale down -> backend simulates infrastructure provisioning timeout.
   - Agent Action: Detects failure status -> does **not** claim success -> re-checks live state (verifies 5 instances remain) -> produces honest explanation detailing the failure.

5. **Edge Cases**:
   - Service already at minimum capacity (`auth-service`): Decides `NO_ACTION` to respect `min_instances`.
   - Unhealthy service: Decides `NO_ACTION` to prevent outage amplification.
   - Deterministic safety rejection: Backend rejects actions violating constraints.

---

## 4. Adapters & Interface Contract (For Laksh)

The agent operates over abstract interfaces (`CloudInvestigationToolInterface`, `CloudActionExecutionInterface`):
- `MockCloudAdapter`: Complete in-memory simulated cloud environment for offline development and testing.
- `HttpBackendAdapter`: Connects to Laksh's FastAPI backend (`http://localhost:8000`):

### Expected Backend Endpoints:
```
GET  /api/services/{service_id}
GET  /api/services/{service_id}/metrics
GET  /api/services/{service_id}/traffic
GET  /api/services/{service_id}/health
GET  /api/services/{service_id}/constraints
GET  /api/services/{service_id}/cost
POST /api/actions
GET  /api/actions/{action_id}
GET  /api/actions/{action_id}/verify
```

---

## 5. Running Tests

Run the automated test suite using Python's standard `unittest`:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
