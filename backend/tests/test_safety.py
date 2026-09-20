from backend.models import (
    ActionRequest,
    ActionType,
    HealthStatus,
    TrafficTrend,
)
from backend.safety.engine import safety_engine


def test_safety_rejects_below_minimum():
    service = {
        "service_id": "reports-worker",
        "instances": 4,
        "min_instances": 2,
        "max_instances": 10,
        "health": HealthStatus.HEALTHY,
        "latency_ms": 100.0,
        "cpu_percent": 10.0,
        "traffic_trend": TrafficTrend.STABLE,
        "request_rate": 0.0,
    }
    request = ActionRequest(
        service_id="reports-worker",
        action=ActionType.SCALE_DOWN,
        target_instances=1,
        reason="Aggressive cost reduction",
    )
    result = safety_engine.validate_action(request, service)
    assert not result.is_safe
    rule_names = [v.rule_name for v in result.violations]
    assert "MIN_CAPACITY_VIOLATION" in rule_names


def test_safety_rejects_above_maximum():
    service = {
        "service_id": "reports-worker",
        "instances": 4,
        "min_instances": 1,
        "max_instances": 10,
        "health": HealthStatus.HEALTHY,
        "latency_ms": 100.0,
        "cpu_percent": 10.0,
        "traffic_trend": TrafficTrend.STABLE,
        "request_rate": 0.0,
    }
    request = ActionRequest(
        service_id="reports-worker",
        action=ActionType.SCALE_UP,
        target_instances=12,
        reason="Scale to max plus buffer",
    )
    result = safety_engine.validate_action(request, service)
    assert not result.is_safe
    rule_names = [v.rule_name for v in result.violations]
    assert "MAX_CAPACITY_VIOLATION" in rule_names


def test_safety_rejects_scale_down_when_traffic_is_rising():
    service = {
        "service_id": "auth-api",
        "instances": 3,
        "min_instances": 1,
        "max_instances": 10,
        "health": HealthStatus.HEALTHY,
        "latency_ms": 180.0,
        "cpu_percent": 60.0,
        "traffic_trend": TrafficTrend.RISING,
        "request_rate": 800.0,
    }
    request = ActionRequest(
        service_id="auth-api",
        action=ActionType.SCALE_DOWN,
        target_instances=2,
        reason="Try to save money anyway",
    )
    result = safety_engine.validate_action(request, service)
    assert not result.is_safe
    rule_names = [v.rule_name for v in result.violations]
    assert "RISING_TRAFFIC_GUARDRAIL" in rule_names


def test_safety_rejects_scale_down_when_latency_is_high():
    service = {
        "service_id": "web-api",
        "instances": 4,
        "min_instances": 1,
        "max_instances": 10,
        "health": HealthStatus.HEALTHY,
        "latency_ms": 310.0,  # Exceeds 250ms threshold
        "cpu_percent": 50.0,
        "traffic_trend": TrafficTrend.STABLE,
        "request_rate": 200.0,
    }
    request = ActionRequest(
        service_id="web-api",
        action=ActionType.SCALE_DOWN,
        target_instances=3,
        reason="Scale down",
    )
    result = safety_engine.validate_action(request, service)
    assert not result.is_safe
    rule_names = [v.rule_name for v in result.violations]
    assert "HIGH_LATENCY_GUARDRAIL" in rule_names


def test_safety_rejects_scale_down_for_unhealthy_service():
    service = {
        "service_id": "payment-service",
        "instances": 4,
        "min_instances": 1,
        "max_instances": 10,
        "health": HealthStatus.DEGRADED,
        "latency_ms": 100.0,
        "cpu_percent": 20.0,
        "traffic_trend": TrafficTrend.STABLE,
        "request_rate": 10.0,
    }
    request = ActionRequest(
        service_id="payment-service",
        action=ActionType.SCALE_DOWN,
        target_instances=2,
        reason="Scale down degraded service",
    )
    result = safety_engine.validate_action(request, service)
    assert not result.is_safe
    rule_names = [v.rule_name for v in result.violations]
    assert "UNHEALTHY_SERVICE_SCALE_DOWN" in rule_names


def test_safety_approves_valid_cost_optimization():
    service = {
        "service_id": "reports-worker",
        "instances": 4,
        "min_instances": 1,
        "max_instances": 10,
        "health": HealthStatus.HEALTHY,
        "latency_ms": 110.0,
        "cpu_percent": 8.0,
        "traffic_trend": TrafficTrend.STABLE,
        "request_rate": 0.0,
    }
    request = ActionRequest(
        service_id="reports-worker",
        action=ActionType.SCALE_DOWN,
        target_instances=1,
        reason="Idle service scale-down",
    )
    result = safety_engine.validate_action(request, service)
    assert result.is_safe
    assert len(result.violations) == 0
