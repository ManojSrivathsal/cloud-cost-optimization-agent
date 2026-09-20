from __future__ import annotations

from typing import Any, Dict, List, Optional
from backend.models import (
    ActionRequest,
    ActionType,
    HealthStatus,
    SafetyValidationResult,
    SafetyViolation,
    TrafficTrend,
)


class DeterministicSafetyEngine:
    """
    Deterministic Safety Validation Layer.

    Acts as the final authority for all cloud action execution.
    Enforces capacity bounds, health guarantees, latency limits,
    traffic safety, and logical consistency without relying on LLM outputs.
    """

    def validate_action(
        self,
        request: ActionRequest,
        service: Optional[Dict[str, Any]],
    ) -> SafetyValidationResult:
        violations: List[SafetyViolation] = []

        # Rule 1: Service Existence
        if not service:
            violations.append(
                SafetyViolation(
                    rule_name="SERVICE_EXISTS",
                    message=f"Service '{request.service_id}' does not exist in cloud inventory.",
                )
            )
            return SafetyValidationResult(
                is_safe=False,
                violations=violations,
                reason="Service does not exist in cloud inventory.",
            )

        current_instances = service["instances"]
        min_instances = service.get("min_instances", 1)
        max_instances = service.get("max_instances", 10)
        target = request.target_instances
        action = request.action
        health = service.get("health", HealthStatus.HEALTHY)
        latency_ms = service.get("latency_ms", 100.0)
        cpu_percent = service.get("cpu_percent", 10.0)
        traffic_trend = service.get("traffic_trend", TrafficTrend.STABLE)
        request_rate = service.get("request_rate", 0.0)

        # Rule 2: Non-zero instances
        if target <= 0:
            violations.append(
                SafetyViolation(
                    rule_name="NON_ZERO_CAPACITY",
                    message=f"Target instances ({target}) must be strictly greater than 0.",
                )
            )

        # Rule 3: Minimum Capacity Constraint
        if target < min_instances:
            violations.append(
                SafetyViolation(
                    rule_name="MIN_CAPACITY_VIOLATION",
                    message=(
                        f"Target instances ({target}) is below configured minimum "
                        f"({min_instances}) for service '{request.service_id}'."
                    ),
                )
            )

        # Rule 4: Maximum Capacity Constraint
        if target > max_instances:
            violations.append(
                SafetyViolation(
                    rule_name="MAX_CAPACITY_VIOLATION",
                    message=(
                        f"Target instances ({target}) exceeds configured maximum "
                        f"({max_instances}) for service '{request.service_id}'."
                    ),
                )
            )

        # Rule 5: Logical Direction Consistency
        if action == ActionType.SCALE_DOWN:
            if target >= current_instances:
                violations.append(
                    SafetyViolation(
                        rule_name="LOGICAL_DIRECTION_MISMATCH",
                        message=(
                            f"Action is 'scale_down', but target instances ({target}) "
                            f"is not less than current instances ({current_instances})."
                        ),
                    )
                )
        elif action == ActionType.SCALE_UP:
            if target <= current_instances:
                violations.append(
                    SafetyViolation(
                        rule_name="LOGICAL_DIRECTION_MISMATCH",
                        message=(
                            f"Action is 'scale_up', but target instances ({target}) "
                            f"is not greater than current instances ({current_instances})."
                        ),
                    )
                )
        elif action == ActionType.NOOP:
            if target != current_instances:
                violations.append(
                    SafetyViolation(
                        rule_name="NOOP_TARGET_MISMATCH",
                        message="Action is 'noop' but target instances specifies a change.",
                    )
                )

        # Redundant action check
        if target == current_instances and action != ActionType.RESTART:
            violations.append(
                SafetyViolation(
                    rule_name="REDUNDANT_ACTION",
                    message=f"Service already has {current_instances} instances; no capacity change needed.",
                )
            )

        # Specific safety guardrails for SCALE_DOWN operations
        if action == ActionType.SCALE_DOWN:
            # Rule 6: Health Guardrail
            if health in (HealthStatus.DEGRADED, HealthStatus.UNHEALTHY):
                violations.append(
                    SafetyViolation(
                        rule_name="UNHEALTHY_SERVICE_SCALE_DOWN",
                        message=(
                            f"Cannot scale down service '{request.service_id}' with health "
                            f"status '{health.value}'. Scaling down degraded/unhealthy services risks catastrophic outage."
                        ),
                    )
                )

            # Rule 7: Latency Safety Limit (SLO Guardrail)
            max_safe_latency = 250.0
            if latency_ms > max_safe_latency:
                violations.append(
                    SafetyViolation(
                        rule_name="HIGH_LATENCY_GUARDRAIL",
                        message=(
                            f"Current latency ({latency_ms}ms) exceeds the safety threshold of "
                            f"{max_safe_latency}ms. Reducing capacity would breach SLA/SLO."
                        ),
                    )
                )

            # Rule 8: Rising / Spiking Traffic Guardrail
            if traffic_trend in (TrafficTrend.RISING, TrafficTrend.SPIKING):
                violations.append(
                    SafetyViolation(
                        rule_name="RISING_TRAFFIC_GUARDRAIL",
                        message=(
                            f"Traffic is currently {traffic_trend.value} ({request_rate} RPS). "
                            f"Scale down is forbidden by deterministic safety policies during traffic surges."
                        ),
                    )
                )

            # Rule 9: High CPU Utilization Guardrail
            max_safe_cpu_for_scaledown = 65.0
            if cpu_percent > max_safe_cpu_for_scaledown:
                violations.append(
                    SafetyViolation(
                        rule_name="HIGH_CPU_GUARDRAIL",
                        message=(
                            f"Current CPU utilization is {cpu_percent}%, which exceeds the safe "
                            f"scale-down threshold of {max_safe_cpu_for_scaledown}%."
                        ),
                    )
                )

            # Rule 10: Step Change Limit (Prevent extreme drops)
            max_step = service.get("max_step_change", 5)
            if (current_instances - target) > max_step:
                violations.append(
                    SafetyViolation(
                        rule_name="EXCESSIVE_STEP_CHANGE",
                        message=(
                            f"Scale-down step of {current_instances - target} instances exceeds "
                            f"maximum allowable step limit of {max_step}."
                        ),
                    )
                )

        is_safe = len(violations) == 0
        summary_reason = (
            "All deterministic safety checks passed."
            if is_safe
            else f"Safety validation rejected action: {'; '.join(v.message for v in violations)}"
        )

        return SafetyValidationResult(
            is_safe=is_safe,
            violations=violations,
            reason=summary_reason,
        )


safety_engine = DeterministicSafetyEngine()
