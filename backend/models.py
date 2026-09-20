from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class TrafficTrend(str, Enum):
    STABLE = "stable"
    RISING = "rising"
    SPIKING = "spiking"
    FALLING = "falling"


class ActionType(str, Enum):
    SCALE_UP = "scale_up"
    SCALE_DOWN = "scale_down"
    RESTART = "restart"
    NOOP = "noop"


class ActionStatus(str, Enum):
    SUCCESS = "success"
    REJECTED = "rejected"
    FAILED = "failed"


class ServiceEvent(BaseModel):
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    event_type: str
    message: str


# -------------------------------------------------------------------
# Service Overview & Details
# -------------------------------------------------------------------

class ServiceOverview(BaseModel):
    service_id: str
    name: str
    status: str
    health: HealthStatus
    instances: int
    hourly_cost: float
    observed_at: str


class ServiceDetail(BaseModel):
    service_id: str
    name: str
    description: str
    status: str
    health: HealthStatus
    instances: int
    min_instances: int
    max_instances: int
    cpu_percent: float
    memory_percent: float
    request_rate: float
    latency_ms: float
    hourly_cost: float
    cost_per_instance_hour: float
    traffic_trend: TrafficTrend
    observed_at: str
    recent_events: List[ServiceEvent] = []
    failure_simulation_enabled: bool = False


# -------------------------------------------------------------------
# Granular Investigation Endpoints
# -------------------------------------------------------------------

class ServiceMetrics(BaseModel):
    service_id: str
    cpu_percent: float
    memory_percent: float
    request_rate: float
    latency_ms: float
    observed_at: str


class ServiceTraffic(BaseModel):
    service_id: str
    request_rate: float
    traffic_trend: TrafficTrend
    peak_rps: float
    error_rate_percent: float
    observed_at: str


class ServiceHealth(BaseModel):
    service_id: str
    health: HealthStatus
    checks_passing: int
    checks_total: int
    active_alerts: List[str] = []
    observed_at: str


class ServiceCost(BaseModel):
    service_id: str
    instances: int
    cost_per_instance_hour: float
    hourly_cost: float
    daily_projected_cost: float
    monthly_projected_cost: float
    currency: str = "USD"
    is_simulated: bool = True
    observed_at: str


class ServiceConstraints(BaseModel):
    service_id: str
    min_instances: int
    max_instances: int
    max_latency_threshold_ms: float = 250.0
    cpu_scale_down_max_percent: float = 65.0
    allow_scale_down_when_rising_traffic: bool = False
    max_step_change: int = 5


# -------------------------------------------------------------------
# Actions & Verification
# -------------------------------------------------------------------

class ActionRequest(BaseModel):
    service_id: str
    action: ActionType
    target_instances: int
    reason: str


class SafetyViolation(BaseModel):
    rule_name: str
    message: str


class SafetyValidationResult(BaseModel):
    is_safe: bool
    violations: List[SafetyViolation] = []
    reason: Optional[str] = None


class ActionRecord(BaseModel):
    action_id: str
    service_id: str
    action: ActionType
    target_instances: int
    requested_reason: str
    status: ActionStatus
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    previous_instances: int
    new_instances: int
    cost_before: float
    cost_after: float
    safety_violations: List[SafetyViolation] = []
    execution_error: Optional[str] = None


class ActionResponse(BaseModel):
    action_id: str
    status: ActionStatus
    service_id: str
    action: ActionType
    previous_instances: int
    new_instances: int
    reason: Optional[str] = None
    safety_violations: List[SafetyViolation] = []
    execution_error: Optional[str] = None


class ActionVerification(BaseModel):
    action_id: str
    verified: bool
    status: ActionStatus
    service_id: str
    previous_instances: int
    target_instances: int
    current_instances: int
    cost_before: float
    cost_after: float
    estimated_hourly_savings: float
    current_metrics: ServiceMetrics
    message: str


# -------------------------------------------------------------------
# Simulator Controls & Scenarios
# -------------------------------------------------------------------

class ScenarioName(str, Enum):
    SCENARIO_A = "scenario_a"  # Cost optimization
    SCENARIO_B = "scenario_b"  # Rising traffic
    SCENARIO_C = "scenario_c"  # Stale observation
    SCENARIO_D = "scenario_d"  # Failed action


class ScenarioSwitchResponse(BaseModel):
    scenario: str
    description: str
    active_services: List[str]
    message: str


class StaleObservationResponse(BaseModel):
    service_id: str
    stale_metrics: ServiceMetrics
    current_metrics: ServiceMetrics
    time_delta_seconds: float
    is_stale: bool
    warning: str
