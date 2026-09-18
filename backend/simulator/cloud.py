from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.models import (
    ActionRecord,
    ActionStatus,
    ActionType,
    ActionVerification,
    HealthStatus,
    SafetyViolation,
    ScenarioName,
    ScenarioSwitchResponse,
    ServiceConstraints,
    ServiceCost,
    ServiceDetail,
    ServiceEvent,
    ServiceHealth,
    ServiceMetrics,
    ServiceOverview,
    ServiceTraffic,
    StaleObservationResponse,
    TrafficTrend,
)
from backend.simulator.services_data import (
    get_default_services_data,
    get_stale_observation_for,
)


class CloudSimulator:
    """
    In-memory deterministic cloud environment simulator.
    Maintains state of simulated cloud services, metrics, events, and action history.
    """

    def __init__(self) -> None:
        self.services: Dict[str, Dict[str, Any]] = get_default_services_data()
        self.actions: Dict[str, ActionRecord] = {}
        self.current_scenario: str = "baseline"

    def reset(self) -> None:
        """Reset the simulator back to default baseline."""
        self.services = get_default_services_data()
        self.actions.clear()
        self.current_scenario = "baseline"

    # -------------------------------------------------------------------
    # Service Queries
    # -------------------------------------------------------------------

    def list_services(self) -> List[ServiceOverview]:
        result: List[ServiceOverview] = []
        for svc in self.services.values():
            hourly = round(svc["instances"] * svc["cost_per_instance_hour"], 2)
            result.append(
                ServiceOverview(
                    service_id=svc["service_id"],
                    name=svc["name"],
                    status=svc["status"],
                    health=svc["health"],
                    instances=svc["instances"],
                    hourly_cost=hourly,
                    observed_at=svc["observed_at"],
                )
            )
        return result

    def get_service(self, service_id: str) -> Optional[ServiceDetail]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        hourly = round(svc["instances"] * svc["cost_per_instance_hour"], 2)
        events = [
            ServiceEvent(
                timestamp=e["timestamp"],
                event_type=e["event_type"],
                message=e["message"],
            )
            for e in svc.get("recent_events", [])
        ]
        return ServiceDetail(
            service_id=svc["service_id"],
            name=svc["name"],
            description=svc.get("description", ""),
            status=svc["status"],
            health=svc["health"],
            instances=svc["instances"],
            min_instances=svc["min_instances"],
            max_instances=svc["max_instances"],
            cpu_percent=round(svc["cpu_percent"], 1),
            memory_percent=round(svc["memory_percent"], 1),
            request_rate=round(svc["request_rate"], 1),
            latency_ms=round(svc["latency_ms"], 1),
            hourly_cost=hourly,
            cost_per_instance_hour=svc["cost_per_instance_hour"],
            traffic_trend=svc.get("traffic_trend", TrafficTrend.STABLE),
            observed_at=svc["observed_at"],
            recent_events=events,
            failure_simulation_enabled=svc.get("failure_simulation_enabled", False),
        )

    def get_metrics(self, service_id: str) -> Optional[ServiceMetrics]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        return ServiceMetrics(
            service_id=svc["service_id"],
            cpu_percent=round(svc["cpu_percent"], 1),
            memory_percent=round(svc["memory_percent"], 1),
            request_rate=round(svc["request_rate"], 1),
            latency_ms=round(svc["latency_ms"], 1),
            observed_at=svc["observed_at"],
        )

    def get_traffic(self, service_id: str) -> Optional[ServiceTraffic]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        return ServiceTraffic(
            service_id=svc["service_id"],
            request_rate=round(svc["request_rate"], 1),
            traffic_trend=svc.get("traffic_trend", TrafficTrend.STABLE),
            peak_rps=round(svc.get("peak_rps", svc["request_rate"] * 1.2), 1),
            error_rate_percent=round(svc.get("error_rate_percent", 0.0), 2),
            observed_at=svc["observed_at"],
        )

    def get_health(self, service_id: str) -> Optional[ServiceHealth]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        return ServiceHealth(
            service_id=svc["service_id"],
            health=svc["health"],
            checks_passing=svc.get("checks_passing", 5),
            checks_total=svc.get("checks_total", 5),
            active_alerts=svc.get("active_alerts", []),
            observed_at=svc["observed_at"],
        )

    def get_cost(self, service_id: str) -> Optional[ServiceCost]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        instances = svc["instances"]
        rate = svc["cost_per_instance_hour"]
        hourly = round(instances * rate, 2)
        daily = round(hourly * 24, 2)
        monthly = round(hourly * 24 * 30, 2)
        return ServiceCost(
            service_id=svc["service_id"],
            instances=instances,
            cost_per_instance_hour=rate,
            hourly_cost=hourly,
            daily_projected_cost=daily,
            monthly_projected_cost=monthly,
            currency="USD",
            is_simulated=True,
            observed_at=svc["observed_at"],
        )

    def get_constraints(self, service_id: str) -> Optional[ServiceConstraints]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        return ServiceConstraints(
            service_id=svc["service_id"],
            min_instances=svc["min_instances"],
            max_instances=svc["max_instances"],
            max_latency_threshold_ms=250.0,
            cpu_scale_down_max_percent=65.0,
            allow_scale_down_when_rising_traffic=False,
            max_step_change=5,
        )

    def get_stale_observation(self, service_id: str) -> Optional[StaleObservationResponse]:
        svc = self.services.get(service_id)
        if not svc:
            return None
        stale_m = get_stale_observation_for(service_id, svc)
        curr_m = self.get_metrics(service_id)
        if not curr_m:
            return None

        # Calculate time delta between stale timestamp and now
        stale_dt = datetime.fromisoformat(stale_m.observed_at)
        curr_dt = datetime.fromisoformat(curr_m.observed_at)
        delta_sec = abs((curr_dt - stale_dt).total_seconds())

        return StaleObservationResponse(
            service_id=service_id,
            stale_metrics=stale_m,
            current_metrics=curr_m,
            time_delta_seconds=delta_sec,
            is_stale=True,
            warning="Observation timestamp is significantly older than current cloud state. Re-check required before action execution.",
        )

    # -------------------------------------------------------------------
    # Action Execution & Tracking
    # -------------------------------------------------------------------

    def record_rejected_action(
        self,
        service_id: str,
        action: ActionType,
        target_instances: int,
        reason: str,
        violations: List[SafetyViolation],
    ) -> ActionRecord:
        action_id = f"act-{uuid.uuid4().hex[:8]}"
        svc = self.services.get(service_id)
        curr_instances = svc["instances"] if svc else 0
        hourly = (
            round(curr_instances * svc["cost_per_instance_hour"], 2) if svc else 0.0
        )
        record = ActionRecord(
            action_id=action_id,
            service_id=service_id,
            action=action,
            target_instances=target_instances,
            requested_reason=reason,
            status=ActionStatus.REJECTED,
            created_at=datetime.now(timezone.utc).isoformat(),
            previous_instances=curr_instances,
            new_instances=curr_instances,
            cost_before=hourly,
            cost_after=hourly,
            safety_violations=violations,
            execution_error=None,
        )
        self.actions[action_id] = record
        return record

    def execute_action(
        self,
        service_id: str,
        action: ActionType,
        target_instances: int,
        reason: str,
    ) -> ActionRecord:
        action_id = f"act-{uuid.uuid4().hex[:8]}"
        svc = self.services[service_id]
        prev_instances = svc["instances"]
        rate = svc["cost_per_instance_hour"]
        cost_before = round(prev_instances * rate, 2)
        now_str = datetime.now(timezone.utc).isoformat()

        # Check for simulated execution failure (Scenario D)
        if svc.get("failure_simulation_enabled", False):
            record = ActionRecord(
                action_id=action_id,
                service_id=service_id,
                action=action,
                target_instances=target_instances,
                requested_reason=reason,
                status=ActionStatus.FAILED,
                created_at=now_str,
                previous_instances=prev_instances,
                new_instances=prev_instances,
                cost_before=cost_before,
                cost_after=cost_before,
                safety_violations=[],
                execution_error="Cloud provider capacity error: requested instance type unavailable in us-east-1a.",
            )
            svc.setdefault("recent_events", []).insert(
                0,
                {
                    "timestamp": now_str,
                    "event_type": "error",
                    "message": f"Action {action_id} failed: Cloud provider capacity unavailable.",
                },
            )
            self.actions[action_id] = record
            return record

        # Execute safe action
        svc["instances"] = target_instances
        cost_after = round(target_instances * rate, 2)

        # Deterministically recalculate utilization and latency based on new instance ratio
        ratio = prev_instances / max(1, target_instances)
        if svc["request_rate"] > 0:
            svc["cpu_percent"] = min(95.0, max(5.0, round(svc["cpu_percent"] * ratio, 1)))
            if ratio > 1.0:
                # Scaling down under traffic increases latency slightly
                svc["latency_ms"] = min(600.0, round(svc["latency_ms"] * (1.0 + 0.3 * (ratio - 1.0)), 1))
            else:
                # Scaling up reduces latency
                svc["latency_ms"] = max(30.0, round(svc["latency_ms"] * (1.0 / ratio), 1))
        else:
            # Idle service: cpu stays minimal
            svc["cpu_percent"] = max(4.0, min(12.0, svc["cpu_percent"]))
            svc["latency_ms"] = max(80.0, min(130.0, svc["latency_ms"]))

        svc["observed_at"] = now_str
        svc.setdefault("recent_events", []).insert(
            0,
            {
                "timestamp": now_str,
                "event_type": "info",
                "message": f"Successfully scaled {action.value} from {prev_instances} to {target_instances} instances.",
            },
        )

        record = ActionRecord(
            action_id=action_id,
            service_id=service_id,
            action=action,
            target_instances=target_instances,
            requested_reason=reason,
            status=ActionStatus.SUCCESS,
            created_at=now_str,
            previous_instances=prev_instances,
            new_instances=target_instances,
            cost_before=cost_before,
            cost_after=cost_after,
            safety_violations=[],
            execution_error=None,
        )
        self.actions[action_id] = record
        return record

    def get_action(self, action_id: str) -> Optional[ActionRecord]:
        return self.actions.get(action_id)

    def list_actions(self) -> List[ActionRecord]:
        return list(self.actions.values())

    def verify_action(self, action_id: str) -> Optional[ActionVerification]:
        record = self.actions.get(action_id)
        if not record:
            return None

        svc = self.services.get(record.service_id)
        current_instances = svc["instances"] if svc else record.new_instances
        metrics = self.get_metrics(record.service_id) or ServiceMetrics(
            service_id=record.service_id,
            cpu_percent=0.0,
            memory_percent=0.0,
            request_rate=0.0,
            latency_ms=0.0,
            observed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Verification logic:
        # Success actions verify target_instances == current_instances
        # Rejected/Failed actions verify that state remained safely untouched
        if record.status == ActionStatus.SUCCESS:
            is_verified = current_instances == record.target_instances
            msg = (
                f"Action verified: capacity successfully adjusted from {record.previous_instances} "
                f"to {current_instances} instances as requested."
                if is_verified
                else "Action verification failed: current capacity differs from target."
            )
        elif record.status == ActionStatus.REJECTED:
            is_verified = current_instances == record.previous_instances
            msg = (
                f"Action rejection verified: system safely prevented unauthorized change. "
                f"Capacity remains intact at {current_instances} instances."
            )
        else:  # FAILED
            is_verified = current_instances == record.previous_instances
            msg = (
                f"Failed action verified: cloud state remains consistent at {current_instances} "
                f"instances without partial corruption."
            )

        hourly_savings = max(0.0, round(record.cost_before - record.cost_after, 2))

        return ActionVerification(
            action_id=record.action_id,
            verified=is_verified,
            status=record.status,
            service_id=record.service_id,
            previous_instances=record.previous_instances,
            target_instances=record.target_instances,
            current_instances=current_instances,
            cost_before=record.cost_before,
            cost_after=record.cost_after,
            estimated_hourly_savings=hourly_savings,
            current_metrics=metrics,
            message=msg,
        )

    # -------------------------------------------------------------------
    # Scenario Management
    # -------------------------------------------------------------------

    def switch_scenario(self, scenario: ScenarioName) -> ScenarioSwitchResponse:
        self.reset()
        self.current_scenario = scenario.value
        now_str = datetime.now(timezone.utc).isoformat()

        if scenario == ScenarioName.SCENARIO_A:
            # Scenario A: Cost Optimization
            # reports-worker is idle, 4 instances, 0 RPS, safe to scale down to 1
            desc = "Scenario A (Cost Optimization): 'reports-worker' is idle (4 instances, 0 RPS, low CPU) and ready for safe scale-down to 1."
            self.services["reports-worker"]["cpu_percent"] = 8.5
            self.services["reports-worker"]["request_rate"] = 0.0
            self.services["reports-worker"]["instances"] = 4
            self.services["reports-worker"]["traffic_trend"] = TrafficTrend.STABLE

        elif scenario == ScenarioName.SCENARIO_B:
            # Scenario B: Rising Traffic
            # auth-api traffic surged, CPU 88%, latency 320ms, rising trend
            desc = "Scenario B (Rising Traffic): 'auth-api' is experiencing heavy rising traffic (88% CPU, 320ms latency). Blind scale-down must be rejected by safety rules."
            self.services["auth-api"]["cpu_percent"] = 88.0
            self.services["auth-api"]["request_rate"] = 1200.0
            self.services["auth-api"]["latency_ms"] = 320.0
            self.services["auth-api"]["traffic_trend"] = TrafficTrend.RISING
            self.services["auth-api"]["active_alerts"] = ["TrafficSurgeSpike", "LatencySLOBreach"]

        elif scenario == ScenarioName.SCENARIO_C:
            # Scenario C: Stale Observation
            # analytics-pipeline live state is 550 RPS, while cached observation is old
            desc = "Scenario C (Stale Observation): 'analytics-pipeline' live metrics reflect high activity (550 RPS), but cached snapshot is 45 mins old. Agent must detect stale data."
            self.services["analytics-pipeline"]["request_rate"] = 550.0
            self.services["analytics-pipeline"]["cpu_percent"] = 72.0
            self.services["analytics-pipeline"]["observed_at"] = now_str

        elif scenario == ScenarioName.SCENARIO_D:
            # Scenario D: Failed Action Simulation
            # payment-processor has simulated provider capacity failure
            desc = "Scenario D (Failed Action): 'payment-processor' has simulated cloud provider failure enabled. Requests will fail execution safely while keeping state consistent."
            self.services["payment-processor"]["failure_simulation_enabled"] = True

        return ScenarioSwitchResponse(
            scenario=scenario.value,
            description=desc,
            active_services=list(self.services.keys()),
            message=f"Simulator switched to {scenario.value}.",
        )


# Global singleton simulator instance
simulator = CloudSimulator()
