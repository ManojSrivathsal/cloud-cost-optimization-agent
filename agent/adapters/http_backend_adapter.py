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
            service_name=data.get("service_name", service_id),
            current_instances=int(data.get("current_instances", data.get("instances", 1))),
            status=data.get("status", "running"),
            instance_type=data.get("instance_type", "t3.medium"),
            last_updated=data.get("last_updated", data.get("timestamp", current_iso_timestamp())),
        )

    def get_service_metrics(self, service_id: str) -> ServiceMetrics:
        data = self._get(f"/api/services/{service_id}/metrics")
        return ServiceMetrics(
            cpu_utilization_pct=float(data.get("cpu_utilization_pct", data.get("cpu_utilization", data.get("cpu", 0.0)))),
            memory_utilization_pct=float(data.get("memory_utilization_pct", data.get("memory_utilization", data.get("memory", 0.0)))),
            timestamp=data.get("timestamp", current_iso_timestamp()),
        )

    def get_service_traffic(self, service_id: str) -> ServiceTraffic:
        data = self._get(f"/api/services/{service_id}/traffic")
        return ServiceTraffic(
            request_rate_rps=float(data.get("request_rate_rps", data.get("request_rate", data.get("rps", 0.0)))),
            latency_p95_ms=float(data.get("latency_p95_ms", data.get("latency_p95", data.get("latency", 0.0)))),
            error_rate_pct=float(data.get("error_rate_pct", data.get("error_rate", 0.0))),
            timestamp=data.get("timestamp", current_iso_timestamp()),
        )

    def get_service_health(self, service_id: str) -> ServiceHealth:
        data = self._get(f"/api/services/{service_id}/health")
        return ServiceHealth(
            status=data.get("status", "healthy"),
            message=data.get("message", "Service healthy"),
            last_check_timestamp=data.get("last_check_timestamp", data.get("timestamp", current_iso_timestamp())),
        )

    def get_service_constraints(self, service_id: str) -> ServiceConstraints:
        data = self._get(f"/api/services/{service_id}/constraints")
        return ServiceConstraints(
            min_instances=int(data.get("min_instances", 1)),
            max_instances=int(data.get("max_instances", 10)),
            max_latency_p95_ms=float(data.get("max_latency_p95_ms", data.get("max_latency", 250.0))),
            max_cpu_pct=float(data.get("max_cpu_pct", 80.0)),
            can_scale_down=bool(data.get("can_scale_down", True)),
        )

    def get_service_cost(self, service_id: str) -> ServiceCost:
        data = self._get(f"/api/services/{service_id}/cost")
        hourly_rate = float(data.get("hourly_cost_per_instance", data.get("cost_per_instance", 0.10)))
        total_cost = float(data.get("total_hourly_cost", data.get("current_cost", hourly_rate)))
        return ServiceCost(
            hourly_cost_per_instance=hourly_rate,
            total_hourly_cost=total_cost,
            currency=data.get("currency", "USD"),
            monthly_projection_usd=float(data.get("monthly_projection_usd", round(total_cost * 24 * 30, 2))),
        )

    # CloudActionExecutionInterface
    def submit_action(self, action_request: ActionRequest) -> ActionResult:
        payload = {
            "action_id": action_request.action_id,
            "service_id": action_request.service_id,
            "action": action_request.action.value,
            "target_instances": action_request.target_instances,
            "reason": action_request.reason,
            "expected_effect": action_request.expected_effect,
            "safety_considerations": action_request.safety_considerations,
        }
        data = self._post("/api/actions", payload)
        status_raw = data.get("status", "success")
        try:
            status_enum = ActionExecutionStatus(status_raw)
        except ValueError:
            status_enum = ActionExecutionStatus.FAILED

        return ActionResult(
            action_id=data.get("action_id", action_request.action_id),
            service_id=data.get("service_id", action_request.service_id),
            status=status_enum,
            previous_instances=int(data.get("previous_instances", 0)),
            new_instances=int(data.get("new_instances", 0)),
            error=data.get("error"),
            message=data.get("message", ""),
            timestamp=data.get("timestamp", current_iso_timestamp()),
        )

    def get_action_status(self, action_id: str) -> ActionResult:
        data = self._get(f"/api/actions/{action_id}")
        status_raw = data.get("status", "success")
        try:
            status_enum = ActionExecutionStatus(status_raw)
        except ValueError:
            status_enum = ActionExecutionStatus.FAILED

        return ActionResult(
            action_id=data.get("action_id", action_id),
            service_id=data.get("service_id", ""),
            status=status_enum,
            previous_instances=int(data.get("previous_instances", 0)),
            new_instances=int(data.get("new_instances", 0)),
            error=data.get("error"),
            message=data.get("message", ""),
            timestamp=data.get("timestamp", current_iso_timestamp()),
        )

    def verify_action(self, action_id: str) -> Dict[str, Any]:
        return self._get(f"/api/actions/{action_id}/verify")
