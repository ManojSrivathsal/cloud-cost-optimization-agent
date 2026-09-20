"""
agent/models.py
Core data structures and schemas for the Cloud Cost Optimization Agent.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


def current_iso_timestamp() -> str:
    """Return the current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class ActionType(str, Enum):
    SCALE_DOWN = "scale_down"
    SCALE_UP = "scale_up"
    RESIZE = "resize"
    STOP_IDLE = "stop_idle"
    NO_ACTION = "no_action"


class ActionExecutionStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    REJECTED = "rejected"
    SKIPPED = "skipped"


@dataclass
class ServiceState:
    service_id: str
    service_name: str
    current_instances: int
    status: str = "running"  # running, degraded, stopped
    instance_type: str = "t3.medium"
    last_updated: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ServiceMetrics:
    cpu_utilization_pct: float
    memory_utilization_pct: float
    timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ServiceTraffic:
    request_rate_rps: float
    latency_p95_ms: float
    error_rate_pct: float = 0.0
    timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ServiceHealth:
    status: str = "healthy"  # healthy, degraded, unhealthy
    message: str = "All health checks passing"
    last_check_timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ServiceConstraints:
    min_instances: int = 1
    max_instances: int = 10
    max_latency_p95_ms: float = 250.0
    max_cpu_pct: float = 80.0
    can_scale_down: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ServiceCost:
    hourly_cost_per_instance: float
    total_hourly_cost: float
    currency: str = "USD"
    monthly_projection_usd: float = 0.0

    def __post_init__(self):
        if self.monthly_projection_usd == 0.0 and self.total_hourly_cost > 0:
            self.monthly_projection_usd = round(self.total_hourly_cost * 24 * 30, 2)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class InvestigationEvidence:
    service_id: str
    state: ServiceState
    metrics: ServiceMetrics
    traffic: ServiceTraffic
    health: ServiceHealth
    constraints: ServiceConstraints
    cost: ServiceCost
    is_stale: bool = False
    staleness_warning: Optional[str] = None
    collected_at: str = field(default_factory=current_iso_timestamp)
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_id": self.service_id,
            "state": self.state.to_dict(),
            "metrics": self.metrics.to_dict(),
            "traffic": self.traffic.to_dict(),
            "health": self.health.to_dict(),
            "constraints": self.constraints.to_dict(),
            "cost": self.cost.to_dict(),
            "is_stale": self.is_stale,
            "staleness_warning": self.staleness_warning,
            "collected_at": self.collected_at,
            "raw_data": self.raw_data,
        }


@dataclass
class ActionRequest:
    action_id: str
    service_id: str
    action: ActionType
    target_instances: Optional[int] = None
    target_size: Optional[str] = None
    reason: str = ""
    expected_effect: str = ""
    safety_considerations: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["action"] = self.action.value
        return data


@dataclass
class ActionResult:
    action_id: str
    service_id: str
    status: ActionExecutionStatus
    previous_instances: int
    new_instances: int
    error: Optional[str] = None
    message: str = ""
    timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        return data


@dataclass
class AgentDecision:
    service_id: str
    decision: ActionType
    proposed_action: Optional[ActionRequest]
    confidence: float
    reason: str
    evidence: List[str]
    expected_effect: str
    safety_considerations: List[str]
    decision_timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_id": self.service_id,
            "decision": self.decision.value,
            "proposed_action": self.proposed_action.to_dict() if self.proposed_action else None,
            "confidence": self.confidence,
            "reason": self.reason,
            "evidence": self.evidence,
            "expected_effect": self.expected_effect,
            "safety_considerations": self.safety_considerations,
            "decision_timestamp": self.decision_timestamp,
        }


@dataclass
class VerificationResult:
    service_id: str
    action_id: Optional[str]
    is_verified: bool
    success: bool
    expected_state: Dict[str, Any]
    actual_state: Dict[str, Any]
    is_effective: bool
    verification_notes: str
    timestamp: str = field(default_factory=current_iso_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TimelineEvent:
    step: str
    description: str
    timestamp: str = field(default_factory=current_iso_timestamp)
    data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AgentExecutionResult:
    run_id: str
    service_id: str
    objective: str
    evidence: Optional[InvestigationEvidence]
    decision: AgentDecision
    action_request: Optional[ActionRequest]
    action_result: Optional[ActionResult]
    post_action_state: Optional[ServiceState]
    verification: Optional[VerificationResult]
    final_explanation: str
    timeline: List[TimelineEvent] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "service_id": self.service_id,
            "objective": self.objective,
            "evidence": self.evidence.to_dict() if self.evidence else None,
            "decision": self.decision.to_dict() if self.decision else None,
            "action_request": self.action_request.to_dict() if self.action_request else None,
            "action_result": self.action_result.to_dict() if self.action_result else None,
            "post_action_state": self.post_action_state.to_dict() if self.post_action_state else None,
            "verification": self.verification.to_dict() if self.verification else None,
            "final_explanation": self.final_explanation,
            "timeline": [t.to_dict() for t in self.timeline],
        }
