"""
tests/test_agent_scenarios.py
Comprehensive automated test suite for the AI Agent / Decision Engine.
Validates all four official scenarios (A, B, C, D), natural-language understanding,
LLM primary reasoning with deterministic fallback, and backend deterministic safety.
"""

import unittest
from datetime import datetime, timezone, timedelta

from agent.models import (
    ActionType,
    ActionExecutionStatus,
    ServiceState,
    ServiceMetrics,
    ServiceTraffic,
    ServiceHealth,
    ServiceConstraints,
    ServiceCost,
    ActionRequest,
)
from agent.adapters import MockCloudAdapter
from agent.agent import CloudCostOptimizationAgent
from agent.llm import LocalSimulatedLLM


class TestCloudCostOptimizationAgent(unittest.TestCase):
    """Test suite for agent orchestration, LLM reasoning, and safety layers."""

    def setUp(self):
        self.adapter = MockCloudAdapter()
        self.llm = LocalSimulatedLLM()
        self.agent = CloudCostOptimizationAgent(
            investigation_adapter=self.adapter,
            action_adapter=self.adapter,
            llm=self.llm,
            staleness_threshold_seconds=300.0,
        )

    def test_natural_language_request_flow(self):
        """
        Test that agent accepts natural-language user prompt,
        extracts target service via LLM NLU, investigates, reasons, and executes.
        """
        result = self.agent.run_request(
            user_request="Our reports worker compute costs are too high. Please optimize capacity.",
        )
        self.assertEqual(result.service_id, "reports-worker")
        self.assertEqual(result.decision.decision, ActionType.SCALE_DOWN)
        self.assertEqual(result.action_result.status, ActionExecutionStatus.SUCCESS)
        self.assertTrue(result.verification.success)
        self.assertIn("Natural-Language Understanding", [t.step for t in result.timeline])

    def test_scenario_a_cost_optimization(self):
        """
        Scenario A: Cost Optimization
        A service (reports-worker) has low utilization and near-zero traffic.
        The LLM reasons over the telemetry and proposes scale_down to 1 instance,
        the backend safety layer approves and executes, and post-action verification
        confirms the new instance count.
        """
        result = self.agent.run(
            service_id="reports-worker",
            objective="Identify cost-saving opportunities and scale down idle capacity",
        )

        # 1. Verify Investigation
        self.assertIsNotNone(result.evidence)
        self.assertEqual(result.evidence.service_id, "reports-worker")
        self.assertLess(result.evidence.metrics.cpu_utilization_pct, 20.0)
        self.assertLess(result.evidence.traffic.request_rate_rps, 10.0)

        # 2. Verify Decision
        self.assertEqual(result.decision.decision, ActionType.SCALE_DOWN)
        self.assertIsNotNone(result.decision.proposed_action)
        self.assertEqual(result.decision.proposed_action.target_instances, 1)
        self.assertGreater(result.decision.confidence, 0.90)

        # 3. Verify Action Execution
        self.assertIsNotNone(result.action_result)
        self.assertEqual(result.action_result.status, ActionExecutionStatus.SUCCESS)
        self.assertEqual(result.action_result.previous_instances, 4)
        self.assertEqual(result.action_result.new_instances, 1)

        # 4. Verify Post-Action Verification
        self.assertIsNotNone(result.verification)
        self.assertTrue(result.verification.is_verified)
        self.assertTrue(result.verification.success)
        self.assertTrue(result.verification.is_effective)
        self.assertEqual(result.verification.actual_state["current_instances"], 1)

        # 5. Verify Explanation
        self.assertIn("reports-worker", result.final_explanation)

    def test_scenario_b_rising_traffic(self):
        """
        Scenario B: Rising Traffic
        Traffic is escalating on checkout-api and p95 latency is nearing SLA limit.
        The agent must recognize that scaling down is dangerous, and instead scale up
        or preserve capacity to protect SLOs.
        """
        result = self.agent.run(
            service_id="checkout-api",
            objective="Evaluate service cost and capacity",
        )

        # 1. Verify Investigation
        self.assertIsNotNone(result.evidence)
        self.assertGreater(result.evidence.traffic.request_rate_rps, 500.0)
        self.assertGreater(result.evidence.metrics.cpu_utilization_pct, 80.0)

        # 2. Verify Decision does NOT scale down
        self.assertNotEqual(result.decision.decision, ActionType.SCALE_DOWN)
        self.assertEqual(result.decision.decision, ActionType.SCALE_UP)
        self.assertIsNotNone(result.decision.proposed_action)
        self.assertGreaterEqual(result.decision.proposed_action.target_instances, 4)

        # 3. Verify Execution
        self.assertIsNotNone(result.action_result)
        self.assertEqual(result.action_result.status, ActionExecutionStatus.SUCCESS)
        self.assertEqual(result.action_result.previous_instances, 3)
        self.assertEqual(result.action_result.new_instances, 5)

        # 4. Verify Verification
        self.assertTrue(result.verification.success)
        self.assertEqual(result.verification.actual_state["current_instances"], 5)

    def test_scenario_c_stale_observation(self):
        """
        Scenario C: Stale Observation
        The caller provides an observation from 2 hours ago showing low CPU.
        The agent detects the stale timestamp, re-fetches live telemetry,
        and reasons on fresh live data.
        """
        two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        stale_obs = {
            "service_id": "order-processor",
            "cpu_utilization_pct": 5.0,
            "request_rate_rps": 0.5,
            "timestamp": two_hours_ago,
        }

        result = self.agent.run(
            service_id="order-processor",
            objective="Optimize cost using received telemetry",
            initial_observation=stale_obs,
        )

        # Verify timeline records stale data detection
        steps = [t.step for t in result.timeline]
        self.assertIn("Stale Data Detection", steps)

        # Verify agent re-checked live data (order-processor has active traffic)
        self.assertGreater(result.evidence.metrics.cpu_utilization_pct, 50.0)

        # The agent should NOT scale down active order-processor!
        self.assertEqual(result.decision.decision, ActionType.NO_ACTION)

    def test_scenario_d_failed_action(self):
        """
        Scenario D: Failed Action
        The backend reports that the action failed due to infrastructure timeout.
        The agent must:
        - Detect the failure
        - Avoid claiming success
        - Re-check live state to confirm instance count remains unchanged
        - Truthfully explain what happened
        """
        result = self.agent.run(
            service_id="analytics-stream",
            objective="Scale down unused capacity",
        )

        # 1. Decision was to scale down
        self.assertEqual(result.decision.decision, ActionType.SCALE_DOWN)

        # 2. Backend reported failure
        self.assertIsNotNone(result.action_result)
        self.assertEqual(result.action_result.status, ActionExecutionStatus.FAILED)
        self.assertIn("hypervisor error", result.action_result.error.lower())

        # 3. Post-action verification MUST reflect failure, NOT success!
        self.assertIsNotNone(result.verification)
        self.assertFalse(result.verification.success)
        self.assertFalse(result.verification.is_effective)
        # Instances must still be 5
        self.assertEqual(result.verification.actual_state["current_instances"], 5)

        # 4. Final explanation must reflect failure truthfully
        self.assertIn("failed", result.final_explanation.lower())

    def test_edge_case_already_at_minimum_instances(self):
        """
        Edge Case: Service has low utilization, but is already at minimum instances.
        Agent must refuse to scale down below minimum constraints and decide NO_ACTION.
        """
        result = self.agent.run(
            service_id="auth-service",
            objective="Optimize costs for identity service",
        )

        self.assertEqual(result.decision.decision, ActionType.NO_ACTION)
        self.assertIsNone(result.decision.proposed_action)
        self.assertIsNone(result.action_result)
        self.assertTrue(result.verification.success)

    def test_edge_case_unhealthy_service(self):
        """
        Edge Case: Unhealthy service must not be scaled down.
        """
        self.adapter.register_service(
            service_id="failing-service",
            state=ServiceState("failing-service", "Failing Service", current_instances=4, status="degraded"),
            metrics=ServiceMetrics(cpu_utilization_pct=10.0, memory_utilization_pct=20.0),
            traffic=ServiceTraffic(request_rate_rps=1.0, latency_p95_ms=50.0),
            health=ServiceHealth(status="unhealthy", message="Disk I/O errors detected"),
            constraints=ServiceConstraints(min_instances=1, max_instances=5),
            cost=ServiceCost(0.10, 0.40),
        )

        result = self.agent.run(
            service_id="failing-service",
            objective="Reduce compute cost",
        )

        self.assertEqual(result.decision.decision, ActionType.NO_ACTION)

    def test_deterministic_safety_layer_rejection(self):
        """
        Test that if an action is submitted that violates min_instances,
        the deterministic safety layer rejects it, and the verifier captures it.
        """
        unsafe_req = ActionRequest(
            action_id="act-unsafe-001",
            service_id="reports-worker",
            action=ActionType.SCALE_DOWN,
            target_instances=0,  # min is 1
            reason="Attempting to scale to zero",
        )
        res = self.adapter.submit_action(unsafe_req)
        self.assertEqual(res.status, ActionExecutionStatus.REJECTED)
        self.assertIn("Safety violation", res.error)


if __name__ == "__main__":
    unittest.main()
