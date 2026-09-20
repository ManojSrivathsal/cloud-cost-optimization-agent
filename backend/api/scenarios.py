from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

from backend.models import ScenarioName
from backend.simulator.cloud import simulator

from agent.agent import CloudCostOptimizationAgent
from agent.adapters.http_backend_adapter import HttpBackendAdapter


router = APIRouter(tags=["Scenarios & Simulator Control"])


# Scenario-specific agent configuration.
#
# The simulator is responsible for creating the actual cloud state.
# The agent is responsible for investigating that state, reasoning over
# the evidence, requesting an action, and verifying the result.
SCENARIO_CONFIG = {
    "scenario_a": {
        "service_id": "reports-worker",
        "objective": (
            "Optimize cloud cost safely while preserving service health, "
            "latency, and minimum capacity constraints."
        ),
    },
    "scenario_b": {
        "service_id": "auth-api",
        "objective": (
            "Evaluate the rising-traffic service and determine whether any "
            "capacity optimization is safe while preserving SLOs and "
            "responding correctly to increasing traffic."
        ),
    },
    "scenario_c": {
        "service_id": "analytics-pipeline",
        "objective": (
            "Investigate the service using fresh telemetry and determine "
            "whether the observed state is trustworthy before taking any "
            "capacity optimization action."
        ),
    },
    "scenario_d": {
        "service_id": "payment-processor",
        "objective": (
            "Evaluate whether a cost optimization action is safe, execute "
            "it when approved by deterministic safety checks, and verify "
            "the actual provider execution result."
        ),
    },
}


@router.post("/api/scenarios/{scenario_name}")
def run_scenario(scenario_name: str) -> Dict[str, Any]:
    """
    Switch the simulator to a requested evaluation scenario and then run
    the REAL autonomous Cloud Cost Optimization Agent against that state.

    Flow:

        Scenario selection
            ↓
        Cloud simulator state
            ↓
        Investigation through HttpBackendAdapter
            ↓
        Gemini / decision engine
            ↓
        Deterministic backend safety engine
            ↓
        Action execution
            ↓
        Post-action verification
            ↓
        Final explanation
            ↓
        JSON result for React frontend
    """

    scenario_id = scenario_name.lower()

    try:
        scenario = ScenarioName(scenario_id)
    except ValueError:
        valid_scenarios = [s.value for s in ScenarioName]

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid scenario '{scenario_name}'. "
                f"Must be one of {valid_scenarios}."
            ),
        )

    config = SCENARIO_CONFIG.get(scenario_id)

    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No agent configuration exists for '{scenario_id}'.",
        )

    # ---------------------------------------------------------
    # 1. Switch simulator into the requested scenario
    # ---------------------------------------------------------

    scenario_state = simulator.switch_scenario(scenario)

    # ---------------------------------------------------------
    # 2. Create the REAL HTTP adapter
    #
    # The agent communicates with the same FastAPI backend through
    # the documented REST API.
    # ---------------------------------------------------------

    backend_adapter = HttpBackendAdapter(
        base_url="http://127.0.0.1:8000"
    )

    # ---------------------------------------------------------
    # 3. Create the REAL autonomous agent
    #
    # This uses the existing Gemini-backed decision engine.
    # ---------------------------------------------------------

    agent = CloudCostOptimizationAgent(
        investigation_adapter=backend_adapter,
        action_adapter=backend_adapter,
    )

    # ---------------------------------------------------------
    # 4. Run the complete autonomous workflow
    # ---------------------------------------------------------

    try:
        execution = agent.run(
            service_id=config["service_id"],
            objective=config["objective"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Autonomous agent execution failed: {str(exc)}",
        )

    # ---------------------------------------------------------
    # 5. Return the REAL agent execution result
    #
    # This contains:
    # - investigation evidence
    # - Gemini decision
    # - action request
    # - action execution result
    # - post-action state
    # - verification
    # - final explanation
    # - complete agent timeline
    # ---------------------------------------------------------

    return {
        "scenario": scenario_id,
        "scenario_state": (
            scenario_state.model_dump()
            if hasattr(scenario_state, "model_dump")
            else scenario_state.dict()
            if hasattr(scenario_state, "dict")
            else scenario_state
        ),
        "agent_execution": execution.to_dict(),
    }


@router.get("/api/scenarios")
def get_scenarios() -> Dict[str, Any]:
    """
    Get the current simulator scenario and the available scenarios.
    """

    return {
        "current_scenario": simulator.current_scenario,
        "available_scenarios": [
            {
                "id": "scenario_a",
                "name": "Scenario A — Cost Optimization",
                "description": (
                    "reports-worker is idle (4 instances, 0 RPS). "
                    "Scale-down to 1 instance is safe and reduces cost."
                ),
                "target_service": "reports-worker",
            },
            {
                "id": "scenario_b",
                "name": "Scenario B — Rising Traffic",
                "description": (
                    "auth-api is surging. Scale-down should be blocked "
                    "when rising traffic and resource pressure violate "
                    "safety conditions."
                ),
                "target_service": "auth-api",
            },
            {
                "id": "scenario_c",
                "name": "Scenario C — Stale Observation",
                "description": (
                    "analytics-pipeline contains an old observation and "
                    "requires fresh telemetry before optimization."
                ),
                "target_service": "analytics-pipeline",
            },
            {
                "id": "scenario_d",
                "name": "Scenario D — Failed Action Simulation",
                "description": (
                    "payment-processor passes safety validation but the "
                    "simulated provider execution fails."
                ),
                "target_service": "payment-processor",
            },
        ],
    }


@router.post("/api/reset")
def reset_simulator() -> Dict[str, str]:
    """
    Reset simulator to the initial baseline state.
    """

    simulator.reset()

    return {
        "message": "Cloud simulator successfully reset to baseline."
    }