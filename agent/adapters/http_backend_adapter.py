"""
agent/adapters/http_backend_adapter.py
Production HTTP adapter connecting to Laksh's FastAPI backend.
Conforms strictly to the API contract defined in PROJECT_RULES.md.
"""

from __future__ import annotations
from typing import Dict, Any, Optional
import requests

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
    current_iso_timestamp,
)
from ..tools import CloudInvestigationToolInterface, CloudActionExecutionInterface


class HttpBackendAdapter(CloudInvestigationToolInterface, CloudActionExecutionInterface):
    """
    HTTP REST adapter communicating with the FastAPI backend server.
    """

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")

    def _get(self, endpoint: str) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        resp = requests.get(url, timeout=5.0)
        resp.raise_for_status()
        return resp.json()

    def _post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        resp = requests.post(url, json=payload, timeout=10.0)
        resp.raise_for_status()
        return resp.json()

    # CloudInvestigationToolInterface
    def get_service_state(self, service_id: str) -> ServiceState:
        data = self._get(f"/api/services/{service_id}")
        return ServiceState(
            service_id=data.get("service_id", service_id),
            service_name=data.get("name", data.get("service_name", service_id)),
            current_instances=int(data.get("instances", data.get("current_instances", 1))),
            status=data.get("status", "running"),
            instance_type=data.get("instance_type", "t3.medium"),
            last_updated=data.get("observed_at", data.get("last_updated", current_iso_timestamp())),
        )

    def get_service_metrics(self, service_id: str) -> ServiceMetrics:
        data = self._get(f"/api/services/{service_id}/metrics")
        return ServiceMetrics(
            cpu_utilization_pct=float(data.get("cpu_percent", data.get("cpu_utilization_pct", data.get("cpu", 0.0)))),
            memory_utilization_pct=float(data.get("memory_percent", data.get("memory_utilization_pct", data.get("memory", 0.0)))),
            timestamp=data.get("observed_at", data.get("timestamp", current_iso_timestamp())),
        )

    def get_service_traffic(self, service_id: str) -> ServiceTraffic:
        data = self._get(f"/api/services/{service_id}/traffic")
        latency = float(data.get("latency_ms", data.get("latency_p95_ms", data.get("latency", 0.0))))
        if latency == 0.0:
            try:
                # Also check latency from metrics if not reported directly in traffic endpoint
                metrics_data = self._get(f"/api/services/{service_id}/metrics")
                latency = float(metrics_data.get("latency_ms", 0.0))
            except Exception:
                pass

        return ServiceTraffic(
            request_rate_rps=float(data.get("request_rate", data.get("request_rate_rps", data.get("rps", 0.0)))),
            latency_p95_ms=latency,
            error_rate_pct=float(data.get("error_rate_percent", data.get("error_rate_pct", data.get("error_rate", 0.0)))),
            timestamp=data.get("observed_at", data.get("timestamp", current_iso_timestamp())),
        )

    def get_service_health(self, service_id: str) -> ServiceHealth:
        data = self._get(f"/api/services/{service_id}/health")
        status = data.get("health", data.get("status", "healthy"))
        passing = data.get("checks_passing", 5)
        total = data.get("checks_total", 5)
        msg = f"All {total} health checks passing" if status == "healthy" else f"{passing}/{total} health checks passing"
        return ServiceHealth(
            status=status,
            message=data.get("message", msg),
            last_check_timestamp=data.get("observed_at", data.get("last_check_timestamp", current_iso_timestamp())),
        )

    def get_service_constraints(self, service_id: str) -> ServiceConstraints:
        data = self._get(f"/api/services/{service_id}/constraints")
        return ServiceConstraints(
            min_instances=int(data.get("min_instances", 1)),
            max_instances=int(data.get("max_instances", 10)),
            max_latency_p95_ms=float(data.get("max_latency_threshold_ms", data.get("max_latency_p95_ms", 250.0))),
            max_cpu_pct=float(data.get("cpu_scale_down_max_percent", data.get("max_cpu_pct", 80.0))),
            can_scale_down=bool(data.get("can_scale_down", True)),
        )

    def get_service_cost(self, service_id: str) -> ServiceCost:
        data = self._get(f"/api/services/{service_id}/cost")
        hourly_rate = float(data.get("cost_per_instance_hour", data.get("hourly_cost_per_instance", 1.05)))
        total_cost = float(data.get("hourly_cost", data.get("total_hourly_cost", hourly_rate)))
        return ServiceCost(
            hourly_cost_per_instance=hourly_rate,
            total_hourly_cost=total_cost,
            currency=data.get("currency", "USD"),
            monthly_projection_usd=float(data.get("monthly_projected_cost", round(total_cost * 24 * 30, 2))),
        )

    # CloudActionExecutionInterface
    def submit_action(self, action_request: ActionRequest) -> ActionResult:
        payload = {
            "service_id": action_request.service_id,
            "action": action_request.action.value,
            "target_instances": action_request.target_instances,
            "reason": action_request.reason,
        }
        data = self._post("/api/actions", payload)
        status_raw = data.get("status", "success")
        try:
            status_enum = ActionExecutionStatus(status_raw)
        except ValueError:
            status_enum = ActionExecutionStatus.FAILED

        # Extract safety violations or execution error if present
        err = data.get("execution_error")
        if not err and data.get("safety_violations"):
            err = "; ".join([v.get("message", "") for v in data["safety_violations"]])

        return ActionResult(
            action_id=data.get("action_id", action_request.action_id),
            service_id=data.get("service_id", action_request.service_id),
            status=status_enum,
            previous_instances=int(data.get("previous_instances", 0)),
            new_instances=int(data.get("new_instances", 0)),
            error=err,
            message=data.get("reason", data.get("message", "")),
            timestamp=data.get("observed_at", current_iso_timestamp()),
        )

    def get_action_status(self, action_id: str) -> ActionResult:
        data = self._get(f"/api/actions/{action_id}")
        status_raw = data.get("status", "success")
        try:
            status_enum = ActionExecutionStatus(status_raw)
        except ValueError:
            status_enum = ActionExecutionStatus.FAILED

        err = data.get("execution_error")
        if not err and data.get("safety_violations"):
            err = "; ".join([v.get("message", "") for v in data["safety_violations"]])

        return ActionResult(
            action_id=data.get("action_id", action_id),
            service_id=data.get("service_id", ""),
            status=status_enum,
            previous_instances=int(data.get("previous_instances", 0)),
            new_instances=int(data.get("new_instances", 0)),
            error=err,
            message=data.get("reason", data.get("message", "")),
            timestamp=data.get("observed_at", current_iso_timestamp()),
        )
    def verify_action(self, action_id: str) -> Dict[str, Any]:
        return self._get(f"/api/actions/{action_id}/verify")
