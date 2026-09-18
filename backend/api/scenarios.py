from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from backend.models import ScenarioName, ScenarioSwitchResponse
from backend.simulator.cloud import simulator

router = APIRouter(tags=["Scenarios & Simulator Control"])


@router.post("/api/scenarios/{scenario_name}", response_model=ScenarioSwitchResponse)
def switch_scenario(scenario_name: str) -> ScenarioSwitchResponse:
    """
    Switch the cloud simulator into a test/demo scenario:
    - scenario_a: Cost Optimization (reports-worker idle, safe to scale down)
    - scenario_b: Rising Traffic (auth-api heavy traffic, blind scale-down blocked by safety)
    - scenario_c: Stale Observation (analytics-pipeline has old observation vs live state)
    - scenario_d: Failed Action (payment-processor simulates cloud provider execution failure)
    """
    try:
        scenario = ScenarioName(scenario_name.lower())
    except ValueError:
        valid_scenarios = [s.value for s in ScenarioName]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario '{scenario_name}'. Must be one of {valid_scenarios}.",
        )

    return simulator.switch_scenario(scenario)


@router.get("/api/scenarios")
def get_scenarios() -> Dict[str, Any]:
    """
    Get current scenario state and list of available test scenarios.
    """
    return {
        "current_scenario": simulator.current_scenario,
        "available_scenarios": [
            {
                "id": "scenario_a",
                "name": "Scenario A — Cost Optimization",
                "description": "reports-worker is idle (4 instances, 0 RPS). Scale-down to 1 instance is safe and reduces cost.",
            },
            {
                "id": "scenario_b",
                "name": "Scenario B — Rising Traffic",
                "description": "auth-api is surging (88% CPU, 1200 RPS, rising trend). Scale-down is blocked by safety guardrails.",
            },
            {
                "id": "scenario_c",
                "name": "Scenario C — Stale Observation",
                "description": "analytics-pipeline shows high activity live (550 RPS), but cached observation is 45 mins old.",
            },
            {
                "id": "scenario_d",
                "name": "Scenario D — Failed Action Simulation",
                "description": "payment-processor action passes safety checks but encounters simulated cloud provider capacity failure.",
            },
        ],
    }


@router.post("/api/reset")
def reset_simulator() -> Dict[str, str]:
    """
    Reset simulator to initial baseline state.
    """
    simulator.reset()
    return {"message": "Cloud simulator successfully reset to baseline."}
