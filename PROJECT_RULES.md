# PS3 — THE CLOUD BILL THAT WOULDN'T STOP GROWING

## 1. PROJECT GOAL

Build an autonomous AI agent that investigates cloud infrastructure state, identifies cost-optimization opportunities, makes decisions, enforces safety constraints, executes safe actions, verifies the result, and explains what happened.

The system must demonstrate:

1. Investigation
2. Reasoning
3. Decision making
4. Deterministic safety validation
5. Action execution
6. Post-action verification
7. Clear explanation

The prototype uses a simulated cloud environment. No real cloud infrastructure or real cloud spending is required.

---

## 2. TEAM OWNERSHIP

### Manoj — AI Agent / Decision Engine

Responsible for:

- AI agent orchestration
- Investigation loop
- Tool selection and tool calling
- Reasoning from cloud metrics
- Deciding what action should be taken
- Handling rejected or failed actions
- Detecting stale observations
- Re-checking cloud state
- Post-action verification reasoning
- Final explanation to the user

Core question:

> What should the AI do next, and why?

---

### Laksh — Cloud Simulator + Backend APIs + Safety Engine

Responsible for:

- Simulated cloud environment
- Service state
- CPU utilization
- Memory utilization
- Request rate / traffic
- Latency
- Health status
- Instance count
- Minimum and maximum capacity
- Cost information
- Recent events and timestamps
- Investigation APIs/tools
- Action APIs
- Action execution
- Deterministic safety validation
- Stale-data simulation
- Action-failure simulation
- State updates
- Verification endpoints

Core question:

> Even if the AI makes a bad decision, can the backend prevent an unsafe action?

---

### Rakshita — Frontend + Visualization + Demo Experience

Responsible for:

- React dashboard
- Cloud cost summary
- Service overview
- Metrics visualization
- Agent investigation timeline
- Action status
- Safety result
- Verification result
- Before/after state
- Estimated cost impact
- Error/failure states
- Demo experience

The UI should make the complete agent process understandable quickly.

It must NOT look like a generic chatbot.

---

### Preethi — Testing + Validation + Documentation

Responsible for:

- Test scenarios
- Expected results
- API testing
- Edge cases
- Regression testing
- Safety testing
- Scenario validation
- Demo test cases
- Documentation
- Bug reporting
- Final validation

Preethi should be able to work using:

- VS Code
- Python
- JSON
- GitHub
- Postman / Thunder Client
- Browser
- Free AI tools

She does not require Antigravity Pro.

---

## 3. CORE ARCHITECTURE

The intended architecture is:

User
↓
Frontend
↓
Backend API
↓
AI Agent
↓
Investigation Tools
↓
Cloud Simulator
↓
Safety Engine
↓
Action Execution
↓
State Update
↓
Post-action Verification
↓
Agent Explanation
↓
Frontend

---

## 4. CRITICAL SAFETY PRINCIPLE

The LLM/AI agent must NOT be the final authority for safety.

The AI agent:

- investigates
- reasons
- recommends/selects an action
- provides the reason

The deterministic backend:

- validates the requested action
- enforces minimum capacity
- enforces maximum capacity
- checks health
- checks latency constraints
- checks availability constraints
- rejects unsafe actions
- executes only valid actions

Example:

If:

- minimum instances = 2
- AI requests instances = 1

The backend must reject the action.

Never rely only on an LLM prompt to enforce safety.

---

## 5. OFFICIAL TEST SCENARIOS

The system must support these four scenarios.

### Scenario A — Cost Optimization

The agent identifies an underutilized or idle service.

It investigates the service and determines whether scaling down or another optimization is appropriate.

The system should:

1. Observe metrics
2. Investigate
3. Decide
4. Validate safety
5. Execute the action
6. Re-check state
7. Verify the result
8. Explain the outcome

---

### Scenario B — Rising Traffic

Traffic increases significantly.

The agent must consider current traffic, latency, capacity, and constraints before deciding whether scaling up or taking another action is appropriate.

The agent must not blindly optimize for cost when the service requires additional capacity.

---

### Scenario C — Stale Observation

The agent initially receives an older observation.

The actual/current cloud state has changed.

The system must detect or handle stale information and re-check the current state before taking an unsafe or outdated action.

The agent should reason using the latest available information.

---

### Scenario D — Failed Action

The agent requests an action, but the simulated infrastructure reports that the action failed.

The system must:

1. Detect the failure
2. Avoid pretending the action succeeded
3. Re-check the current state
4. Determine the next appropriate step
5. Explain the failure and final state

---

## 6. EXPECTED INVESTIGATION INFORMATION

The agent may need to investigate:

- Service name
- CPU utilization
- Memory utilization
- Request rate / traffic
- Latency
- Health
- Instance count
- Minimum capacity
- Maximum capacity
- Cost
- Recent events
- Observation timestamp
- Current state

The agent should gather enough evidence before making a decision.

---

## 7. POSSIBLE ACTIONS

The prototype may support actions such as:

- Scale up
- Scale down
- Resize
- Stop idle workload
- Delay workload
- No action

Only actions supported by the backend simulator should be used.

Do not add unnecessary actions just to increase feature count.

---

## 8. API CONTRACT

The frontend and AI agent should communicate with the backend through clear APIs.

Example endpoints:

GET /api/services

GET /api/services/{service_id}/metrics

GET /api/services/{service_id}/traffic

GET /api/services/{service_id}/health

POST /api/actions

GET /api/actions/{action_id}

GET /api/actions/{action_id}/verify

Exact endpoint names may be changed if the team agrees.

Any interface-breaking change must be communicated to the affected teammate before integration.

---

## 9. EXAMPLE ACTION REQUEST

Example:

```json
{
  "service_id": "reports-worker",
  "action": "scale_down",
  "target_instances": 1,
  "reason": "Low utilization and no current traffic"
}
Example response:

{
  "action_id": "act-001",
  "status": "success",
  "previous_instances": 4,
  "new_instances": 1
}

Actual values and schemas may differ depending on the implemented simulator.

10. TECHNOLOGY PRINCIPLES

Preferred stack:

Backend
Python
FastAPI
AI Agent
Python
LLM API
Tool/function calling where appropriate
Frontend
React
Vite
Data

Initially prefer:

JSON
In-memory state
Simple local data

Avoid unnecessary databases or infrastructure unless they provide a clear benefit.

Cloud

Use a simulated cloud environment.

Do not spend money on real AWS/GCP/Azure infrastructure for the prototype.

11. CODE OWNERSHIP

Each teammate owns their assigned area.

Do not rewrite another teammate's module without coordination.

If another module must change to integrate your work:

Explain why the change is required.
Keep the change minimal.
Inform the affected teammate.
Preserve existing interfaces where possible.
12. VIBE-CODING RULE

AI-generated code is allowed and encouraged when useful.

However, every team member must understand the important code they submit.

For significant technical decisions, document:

What was decided?
Why was it needed?
What alternatives were considered?
Why was the selected approach used?
What are the trade-offs?

Do not blindly accept generated code.

13. DEVELOPMENT PRINCIPLE

Prefer:

Working end-to-end prototype > extra features > unnecessary complexity

The system should become runnable as early as possible.

Do not spend most of the hackathon building infrastructure that does not improve the core demonstration.

14. DEMO FLOW

The final demonstration should clearly show:

User request
↓
Agent investigation
↓
Evidence / metrics
↓
Agent decision
↓
Safety validation
↓
Action
↓
Verification
↓
Before/after state
↓
Cost/result
↓
Agent explanation

The audience should be able to understand what the agent did and why.

15. GIT RULES

The main branch is the stable integration branch.

Team members should work on separate branches:

main
manoj-agent
laksh-backend
rakshita-frontend
preethi-testing

Nobody should directly develop features on main.

Commit frequently with meaningful commit messages.

Examples:

Add agent investigation loop
Add service metrics API
Add deterministic safety validation
Add dashboard service cards
Add stale observation tests

Never commit:

API keys
passwords
tokens
.env secrets
private credentials
16. INTEGRATION RULE

Do not wait until the final hours to integrate.

The team should integrate the system progressively:

Frontend
→ Backend
→ Agent
→ Simulator
→ Safety
→ Action
→ Verification
→ Frontend result

Use mock data/interfaces when another component is not ready.

17. DECISION RULE

Small local implementation decisions can be made independently.

Examples:

Variable names
Internal helper functions
Component structure
Test organization

Decisions that affect another teammate's interface must be coordinated.

Examples:

API endpoint changes
Request/response schema changes
Shared data model changes
Agent/backend communication changes
18. SUCCESS CRITERIA

The final prototype should reliably demonstrate:

Cost optimization
Awareness of rising traffic
Stale observation handling
Failed action handling
Deterministic safety enforcement
Post-action verification
Clear agent reasoning/explanation
End-to-end integration
A professional demo interface
19. IMPORTANT TEAM RULE

Everyone should first inspect the existing repository and understand the current state before modifying files.

Do not assume that your module is empty.

Do not duplicate another teammate's work.

Do not wait unnecessarily for permission for small local decisions.

If a decision can break another teammate's work, communicate first.

Build incrementally and keep the system runnable.


### After pasting

Press:

**`Ctrl + S`**

Then **don't create branches yet**.

Next we'll do:

**PROJECT_RULES → commit to main → push to GitHub → create 4 branches → give each teammate their exact setup commands + personalized
```
