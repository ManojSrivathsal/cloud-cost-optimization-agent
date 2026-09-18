"""
agent/demo.py
Interactive CLI demonstration of the Autonomous Cloud Cost Optimization Agent.
Demonstrates all 4 official hackathon scenarios:
- Scenario A: Cost Optimization (scale down idle service)
- Scenario B: Rising Traffic (scale up / preserve capacity)
- Scenario C: Stale Observation (detect outdated data & re-check live state)
- Scenario D: Failed Action (truthfully handle and explain infrastructure failure)
"""

import sys
import os

# Ensure repository root is on sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import json
from datetime import datetime, timezone, timedelta

from agent.models import ActionType
from agent.adapters import MockCloudAdapter
from agent.agent import CloudCostOptimizationAgent
from agent.llm import get_llm_provider, get_llm_diagnostics


def print_banner(title: str):
    print("\n" + "=" * 75)
    print(f"  {title.upper()}")
    print("=" * 75)


def print_result_summary(result):
    print(f"\n[TARGET SERVICE]  : {result.service_id}")
    print(f"[OBJECTIVE]       : {result.objective}")
    print(f"[DECISION]        : {result.decision.decision.value.upper()} (Confidence: {result.decision.confidence * 100:.0f}%)")
    print(f"[REASON]          : {result.decision.reason}")
    
    if result.action_request:
        print(f"[ACTION REQUEST]  : {result.action_request.action.value} -> Target Instances: {result.action_request.target_instances}")
    
    if result.action_result:
        print(f"[BACKEND STATUS]  : {result.action_result.status.value.upper()} ({result.action_result.message or result.action_result.error})")
        print(f"[INSTANCE CHANGE] : {result.action_result.previous_instances} -> {result.action_result.new_instances}")
    
    if result.verification:
        status = "PASSED" if result.verification.success else "FAILED / DISCREPANCY"
        print(f"[VERIFICATION]    : {status} - {result.verification.verification_notes}")
        print(f"[LIVE INSTANCES]  : {result.verification.actual_state.get('current_instances')}")

    print("\n[EXECUTION TIMELINE]")
    for event in result.timeline:
        print(f"  * [{event.step}] {event.description}")

    print("\n[FINAL EXPLANATION]")
    print(result.final_explanation)


def run_demo():
    diag = get_llm_diagnostics()
    print("\n" + "=" * 75)
    print("  AUTONOMOUS CLOUD COST OPTIMIZATION AGENT")
    print("=" * 75)
    print(f"  Active LLM Provider : {diag['provider']}")
    print(f"  Model               : {diag['model']}")
    print(f"  API Key Configured  : {diag['api_key_configured']}")
    print(f"  Real LLM Active     : {diag['is_real_llm']}")
    print("=" * 75)

    adapter = MockCloudAdapter()
    llm = get_llm_provider()
    agent = CloudCostOptimizationAgent(
        investigation_adapter=adapter,
        action_adapter=adapter,
        llm=llm,
        staleness_threshold_seconds=300.0,
    )

    # -------------------------------------------------------------
    # Scenario A: Cost Optimization
    # -------------------------------------------------------------
    print_banner("Scenario A: Cost Optimization (Idle Service)")
    print("Context: reports-worker is running 4 instances with ~8% CPU and minimal traffic.")
    res_a = agent.run_request("Can we cut cloud expenses on our reports worker?")
    print_result_summary(res_a)

    # -------------------------------------------------------------
    # Scenario B: Rising Traffic
    # -------------------------------------------------------------
    print_banner("Scenario B: Rising Traffic (High Load Protection)")
    print("Context: checkout-api has high traffic (>850 RPS) and latency approaching SLA ceiling.")
    res_b = agent.run_request("Check if we can reduce instances on checkout-api to save money.")
    print_result_summary(res_b)

    # -------------------------------------------------------------
    # Scenario C: Stale Observation
    # -------------------------------------------------------------
    print_banner("Scenario C: Stale Observation Detection")
    print("Context: Caller provides a 2-hour-old observation claiming order-processor is idle.")
    stale_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    stale_obs = {
        "service_id": "order-processor",
        "cpu_utilization_pct": 4.0,
        "timestamp": stale_time,
    }
    res_c = agent.run_request(
        "Optimize order-processor based on our last observation report.",
        default_service_id="order-processor",
        initial_observation=stale_obs,
    )
    print_result_summary(res_c)

    # -------------------------------------------------------------
    # Scenario D: Failed Action Handling
    # -------------------------------------------------------------
    print_banner("Scenario D: Failed Action Truthful Handling")
    print("Context: analytics-stream is idle, but the cloud hypervisor times out during scale-down.")
    res_d = agent.run_request(
        "Scale down analytics-stream to reduce cost.",
        default_service_id="analytics-stream",
    )
    print_result_summary(res_d)

    print("\n" + "=" * 75)
    print("  ALL 4 SCENARIOS DEMONSTRATED SUCCESSFULLY")
    print("=" * 75)


if __name__ == "__main__":
    run_demo()
