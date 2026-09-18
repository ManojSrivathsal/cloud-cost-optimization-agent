"""
agent/tools.py
Tool interfaces and abstractions for cloud investigation and action execution.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Dict, Any, Callable
import json

from .models import (
    ServiceState,
    ServiceMetrics,
    ServiceTraffic,
    ServiceHealth,
    ServiceConstraints,
    ServiceCost,
    ActionRequest,
    ActionResult,
)


class CloudInvestigationToolInterface(ABC):
    """Abstract interface defining required cloud investigation capabilities."""

    @abstractmethod
    def get_service_state(self, service_id: str) -> ServiceState:
        """Fetch general state and metadata for a given service."""
        pass

    @abstractmethod
    def get_service_metrics(self, service_id: str) -> ServiceMetrics:
        """Fetch current compute utilization metrics (CPU, Memory)."""
        pass

    @abstractmethod
    def get_service_traffic(self, service_id: str) -> ServiceTraffic:
        """Fetch current traffic metrics (RPS, p95 latency, error rate)."""
        pass

    @abstractmethod
    def get_service_health(self, service_id: str) -> ServiceHealth:
        """Fetch health check status and diagnostic messages."""
        pass

    @abstractmethod
    def get_service_constraints(self, service_id: str) -> ServiceConstraints:
        """Fetch guardrails/constraints (min/max instances, SLA thresholds)."""
        pass

    @abstractmethod
    def get_service_cost(self, service_id: str) -> ServiceCost:
        """Fetch cost information and instance pricing."""
        pass


class CloudActionExecutionInterface(ABC):
    """Abstract interface for submitting actions to the backend execution & safety layer."""

    @abstractmethod
    def submit_action(self, action_request: ActionRequest) -> ActionResult:
        """Submit an action request for backend deterministic safety validation and execution."""
        pass

    @abstractmethod
    def get_action_status(self, action_id: str) -> ActionResult:
        """Fetch the execution status of a submitted action."""
        pass

    @abstractmethod
    def verify_action(self, action_id: str) -> Dict[str, Any]:
        """Ask backend to perform underlying verification of the action."""
        pass


class ToolRegistry:
    """
    Registry for tool calling. Exposes tools as callable functions with schemas,
    compatible with both LLM function calling and deterministic loops.
    """

    def __init__(self, investigation_adapter: CloudInvestigationToolInterface, action_adapter: CloudActionExecutionInterface):
        self.investigation_adapter = investigation_adapter
        self.action_adapter = action_adapter
        self._tools: Dict[str, Callable[..., Any]] = {
            "get_service_state": self.investigation_adapter.get_service_state,
            "get_service_metrics": self.investigation_adapter.get_service_metrics,
            "get_service_traffic": self.investigation_adapter.get_service_traffic,
            "get_service_health": self.investigation_adapter.get_service_health,
            "get_service_constraints": self.investigation_adapter.get_service_constraints,
            "get_service_cost": self.investigation_adapter.get_service_cost,
            "submit_action": self.action_adapter.submit_action,
            "get_action_status": self.action_adapter.get_action_status,
            "verify_action": self.action_adapter.verify_action,
        }

    def execute(self, tool_name: str, **kwargs) -> Any:
        if tool_name not in self._tools:
            raise ValueError(f"Unknown tool '{tool_name}'. Available: {list(self._tools.keys())}")
        return self._tools[tool_name](**kwargs)

    def get_tool_definitions(self) -> list[dict]:
        """Returns JSON schema definitions for LLM tool calling."""
        return [
            {
                "name": "get_service_state",
                "description": "Fetch current status, instance count, and metadata for a cloud service.",
                "parameters": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "get_service_metrics",
                "description": "Fetch CPU and Memory utilization percentages for a service.",
                "parameters": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "get_service_traffic",
                "description": "Fetch request rate (RPS), p95 latency (ms), and error rate for a service.",
                "parameters": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "get_service_health",
                "description": "Fetch health check status and diagnostic messages for a service.",
                "parameters": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "get_service_constraints",
                "description": "Fetch min/max instance boundaries, latency limits, and scaling constraints.",
                "parameters": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "get_service_cost",
                "description": "Fetch hourly cost per instance and total cost for a service.",
                "parameters": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
        ]
