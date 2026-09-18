"""
agent/adapters/mock_cloud_adapter.py
Mock cloud adapter simulating cloud infrastructure, telemetry, and deterministic safety checks.
Allows full end-to-end testing of Scenarios A, B, C, and D prior to backend completion.
"""

from __future__ import annotations
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import uuid

from ..models import (
    ServiceState,
    ServiceMetrics,
    ServiceTraffic,
    ServiceHealth,
    ServiceConstraints,
    ServiceCost,
    ActionRequest,
    ActionResult,
    ActionExecutionStatus,
    ActionType,
    current_iso_timestamp,
)
from ..tools import CloudInvestigationToolInterface, CloudActionExecutionInterface


class MockCloudAdapter(CloudInvestigationToolInterface, CloudActionExecutionInterface):
    """
    Simulated cloud environment with built-in telemetry and safety validation.
    """

    def __init__(self):
        self.services: Dict[str, Dict[str, Any]] = {}
        self.actions_history: Dict[str, ActionResult] = {}
        self.fail_actions_for_services: set[str] = set()
        self._init_default_scenarios()

    def _init_default_scenarios(self):
        now = datetime.now(timezone.utc)
        iso_now = now.isoformat()

        # Scenario A: Cost Optimization candidate (idle/underutilized reports worker)
        self.register_service(
            service_id="reports-worker",
            state=ServiceState(
                service_id="reports-worker",
                service_name="Reports Generation Worker",
                current_instances=4,
                status="running",
                last_updated=iso_now,
            ),
            metrics=ServiceMetrics(
                cpu_utilization_pct=8.5,
                memory_utilization_pct=19.2,
                timestamp=iso_now,
            ),
            traffic=ServiceTraffic(
                request_rate_rps=1.2,
                latency_p95_ms=42.0,
                error_rate_pct=0.0,
                timestamp=iso_now,
            ),
            health=ServiceHealth(
                status="healthy",
                message="All nodes reporting healthy",
                last_check_timestamp=iso_now,
            ),
            constraints=ServiceConstraints(
                min_instances=1,
                max_instances=8,
                max_latency_p95_ms=200.0,
                max_cpu_pct=75.0,
                can_scale_down=True,
            ),
            cost=ServiceCost(
                hourly_cost_per_instance=0.10,
                total_hourly_cost=0.40,
                currency="USD",
            ),
        )

        # Scenario B: Rising Traffic (high load checkout service)
        self.register_service(
            service_id="checkout-api",
            state=ServiceState(
                service_id="checkout-api",
                service_name="Checkout & Payment API",
                current_instances=3,
                status="running",
                last_updated=iso_now,
            ),
            metrics=ServiceMetrics(
                cpu_utilization_pct=84.0,
                memory_utilization_pct=78.5,
                timestamp=iso_now,
            ),
            traffic=ServiceTraffic(
                request_rate_rps=860.0,
                latency_p95_ms=235.0,
                error_rate_pct=1.8,
                timestamp=iso_now,
            ),
            health=ServiceHealth(
                status="healthy",
                message="Under heavy load, latency elevated",
                last_check_timestamp=iso_now,
            ),
            constraints=ServiceConstraints(
                min_instances=2,
                max_instances=10,
                max_latency_p95_ms=250.0,
                max_cpu_pct=80.0,
                can_scale_down=True,
            ),
            cost=ServiceCost(
                hourly_cost_per_instance=0.25,
                total_hourly_cost=0.75,
                currency="USD",
            ),
        )

        # Scenario C: Service whose live state is active, but a stale observation might show it as idle
        self.register_service(
            service_id="order-processor",
            state=ServiceState(
                service_id="order-processor",
                service_name="Order Processor Service",
                current_instances=3,
                status="running",
                last_updated=iso_now,
            ),
            metrics=ServiceMetrics(
                cpu_utilization_pct=68.0,
                memory_utilization_pct=60.0,
                timestamp=iso_now,
            ),
            traffic=ServiceTraffic(
                request_rate_rps=350.0,
                latency_p95_ms=110.0,
                error_rate_pct=0.1,
                timestamp=iso_now,
            ),
            health=ServiceHealth(
                status="healthy",
                message="Healthy and active",
                last_check_timestamp=iso_now,
            ),
            constraints=ServiceConstraints(
                min_instances=2,
                max_instances=8,
                max_latency_p95_ms=200.0,
                max_cpu_pct=75.0,
                can_scale_down=True,
            ),
            cost=ServiceCost(
                hourly_cost_per_instance=0.15,
                total_hourly_cost=0.45,
                currency="USD",
            ),
        )

        # Scenario D: Service configured to simulate infrastructure failure upon action execution
        self.register_service(
            service_id="analytics-stream",
            state=ServiceState(
                service_id="analytics-stream",
                service_name="Realtime Analytics Stream",
                current_instances=5,
                status="running",
                last_updated=iso_now,
            ),
            metrics=ServiceMetrics(
                cpu_utilization_pct=11.0,
                memory_utilization_pct=22.0,
                timestamp=iso_now,
            ),
            traffic=ServiceTraffic(
                request_rate_rps=5.0,
                latency_p95_ms=30.0,
                error_rate_pct=0.0,
                timestamp=iso_now,
            ),
            health=ServiceHealth(
                status="healthy",
                message="Operational",
                last_check_timestamp=iso_now,
            ),
            constraints=ServiceConstraints(
                min_instances=1,
                max_instances=10,
                max_latency_p95_ms=200.0,
                max_cpu_pct=70.0,
                can_scale_down=True,
            ),
            cost=ServiceCost(
                hourly_cost_per_instance=0.30,
                total_hourly_cost=1.50,
                currency="USD",
            ),
        )
        self.fail_actions_for_services.add("analytics-stream")

        # Additional edge case: Service already at minimum capacity
        self.register_service(
            service_id="auth-service",
            state=ServiceState(
                service_id="auth-service",
                service_name="Auth Identity Service",
                current_instances=2,
                status="running",
                last_updated=iso_now,
            ),
            metrics=ServiceMetrics(
                cpu_utilization_pct=15.0,
                memory_utilization_pct=25.0,
                timestamp=iso_now,
            ),
            traffic=ServiceTraffic(
                request_rate_rps=10.0,
                latency_p95_ms=20.0,
                error_rate_pct=0.0,
                timestamp=iso_now,
            ),
            health=ServiceHealth(
                status="healthy",
                message="Operational",
                last_check_timestamp=iso_now,
            ),
            constraints=ServiceConstraints(
                min_instances=2,
                max_instances=6,
                max_latency_p95_ms=100.0,
                max_cpu_pct=70.0,
                can_scale_down=True,
            ),
            cost=ServiceCost(
                hourly_cost_per_instance=0.20,
                total_hourly_cost=0.40,
                currency="USD",
            ),
        )

    def register_service(
        self,
        service_id: str,
        state: ServiceState,
        metrics: ServiceMetrics,
        traffic: ServiceTraffic,
        health: ServiceHealth,
        constraints: ServiceConstraints,
        cost: ServiceCost,
    ):
        self.services[service_id] = {
            "state": state,
            "metrics": metrics,
            "traffic": traffic,
            "health": health,
            "constraints": constraints,
            "cost": cost,
        }

    # Investigation Tool implementations
    def get_service_state(self, service_id: str) -> ServiceState:
        if service_id not in self.services:
            raise KeyError(f"Service {service_id} not found in cloud simulator.")
        return self.services[service_id]["state"]

    def get_service_metrics(self, service_id: str) -> ServiceMetrics:
        if service_id not in self.services:
            raise KeyError(f"Service {service_id} not found in cloud simulator.")
        return self.services[service_id]["metrics"]

    def get_service_traffic(self, service_id: str) -> ServiceTraffic:
        if service_id not in self.services:
            raise KeyError(f"Service {service_id} not found in cloud simulator.")
        return self.services[service_id]["traffic"]

    def get_service_health(self, service_id: str) -> ServiceHealth:
        if service_id not in self.services:
            raise KeyError(f"Service {service_id} not found in cloud simulator.")
        return self.services[service_id]["health"]

    def get_service_constraints(self, service_id: str) -> ServiceConstraints:
        if service_id not in self.services:
            raise KeyError(f"Service {service_id} not found in cloud simulator.")
        return self.services[service_id]["constraints"]

    def get_service_cost(self, service_id: str) -> ServiceCost:
        if service_id not in self.services:
            raise KeyError(f"Service {service_id} not found in cloud simulator.")
        return self.services[service_id]["cost"]

    # Action Execution & Safety Layer
    def submit_action(self, action_request: ActionRequest) -> ActionResult:
        service_id = action_request.service_id
        if service_id not in self.services:
            return ActionResult(
                action_id=action_request.action_id or str(uuid.uuid4()),
                service_id=service_id,
                status=ActionExecutionStatus.REJECTED,
                previous_instances=0,
                new_instances=0,
                error=f"Service '{service_id}' does not exist",
                message="Safety check failed: non-existent service.",
            )

        svc = self.services[service_id]
        state: ServiceState = svc["state"]
        constraints: ServiceConstraints = svc["constraints"]
        health: ServiceHealth = svc["health"]
        prev_instances = state.current_instances
        action_id = action_request.action_id or str(uuid.uuid4())

        # 1. Deterministic Backend Safety Checks (Laksh's layer simulation)
        if action_request.action == ActionType.NO_ACTION:
            res = ActionResult(
                action_id=action_id,
                service_id=service_id,
                status=ActionExecutionStatus.SKIPPED,
                previous_instances=prev_instances,
                new_instances=prev_instances,
                message="No action requested. State unchanged.",
            )
            self.actions_history[action_id] = res
            return res

        # Safety Check: Target instances validation
        if action_request.target_instances is not None:
            if action_request.target_instances < constraints.min_instances:
                res = ActionResult(
                    action_id=action_id,
                    service_id=service_id,
                    status=ActionExecutionStatus.REJECTED,
                    previous_instances=prev_instances,
                    new_instances=prev_instances,
                    error=f"Safety violation: Target {action_request.target_instances} instances is below minimum capacity limit {constraints.min_instances}.",
                    message="Action rejected by deterministic safety layer.",
                )
                self.actions_history[action_id] = res
                return res

            if action_request.target_instances > constraints.max_instances:
                res = ActionResult(
                    action_id=action_id,
                    service_id=service_id,
                    status=ActionExecutionStatus.REJECTED,
                    previous_instances=prev_instances,
                    new_instances=prev_instances,
                    error=f"Safety violation: Target {action_request.target_instances} instances exceeds maximum capacity limit {constraints.max_instances}.",
                    message="Action rejected by deterministic safety layer.",
                )
                self.actions_history[action_id] = res
                return res

        # Safety Check: Service health
        if health.status == "unhealthy" and action_request.action in [ActionType.SCALE_DOWN, ActionType.STOP_IDLE]:
            res = ActionResult(
                action_id=action_id,
                service_id=service_id,
                status=ActionExecutionStatus.REJECTED,
                previous_instances=prev_instances,
                new_instances=prev_instances,
                error="Safety violation: Cannot scale down an unhealthy service.",
                message="Action rejected by deterministic safety layer.",
            )
            self.actions_history[action_id] = res
            return res

        # 2. Simulated Hardware/Infrastructure Failure (Scenario D)
        if service_id in self.fail_actions_for_services:
            res = ActionResult(
                action_id=action_id,
                service_id=service_id,
                status=ActionExecutionStatus.FAILED,
                previous_instances=prev_instances,
                new_instances=prev_instances,
                error="Cloud hypervisor error: Node provisioning failed due to backend timeout.",
                message="Action failed during infrastructure execution.",
            )
            self.actions_history[action_id] = res
            return res

        # 3. Successful execution: Update simulated state
        new_instances = action_request.target_instances if action_request.target_instances is not None else prev_instances
        state.current_instances = new_instances
        state.last_updated = current_iso_timestamp()

        # Update cost model accordingly
        cost: ServiceCost = svc["cost"]
        cost.total_hourly_cost = round(new_instances * cost.hourly_cost_per_instance, 4)
        cost.monthly_projection_usd = round(cost.total_hourly_cost * 24 * 30, 2)

        res = ActionResult(
            action_id=action_id,
            service_id=service_id,
            status=ActionExecutionStatus.SUCCESS,
            previous_instances=prev_instances,
            new_instances=new_instances,
            message=f"Successfully executed {action_request.action.value} on {service_id}.",
        )
        self.actions_history[action_id] = res
        return res

    def get_action_status(self, action_id: str) -> ActionResult:
        if action_id not in self.actions_history:
            raise KeyError(f"Action ID {action_id} not found.")
        return self.actions_history[action_id]

    def verify_action(self, action_id: str) -> Dict[str, Any]:
        if action_id not in self.actions_history:
            return {"verified": False, "error": f"Action ID {action_id} not found."}
        act = self.actions_history[action_id]
        svc = self.services.get(act.service_id)
        current_inst = svc["state"].current_instances if svc else None
        return {
            "action_id": action_id,
            "status": act.status.value,
            "recorded_new_instances": act.new_instances,
            "live_current_instances": current_inst,
            "verified": (act.status == ActionExecutionStatus.SUCCESS and current_inst == act.new_instances),
        }
