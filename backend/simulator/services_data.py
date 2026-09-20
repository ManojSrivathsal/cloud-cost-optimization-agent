from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from backend.models import HealthStatus, TrafficTrend, ServiceDetail, ServiceEvent, ServiceMetrics


def get_default_services_data() -> Dict[str, Dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "reports-worker": {
            "service_id": "reports-worker",
            "name": "Reports Worker",
            "description": "Background batch report generator and export pipeline",
            "status": "idle",
            "health": HealthStatus.HEALTHY,
            "instances": 4,
            "min_instances": 1,
            "max_instances": 10,
            "cpu_percent": 9.0,
            "memory_percent": 15.0,
            "request_rate": 0.0,
            "latency_ms": 120.0,
            "cost_per_instance_hour": 1.05,
            "traffic_trend": TrafficTrend.STABLE,
            "observed_at": now,
            "recent_events": [
                {
                    "timestamp": now,
                    "event_type": "info",
                    "message": "Nightly reporting batch finished; queue empty."
                }
            ],
            "failure_simulation_enabled": False,
            "peak_rps": 12.0,
            "error_rate_percent": 0.0,
            "checks_passing": 5,
            "checks_total": 5,
            "active_alerts": [],
        },
        "auth-api": {
            "service_id": "auth-api",
            "name": "Authentication & Session API",
            "description": "Core identity, OAuth token issuer, and user session validator",
            "status": "healthy",
            "health": HealthStatus.HEALTHY,
            "instances": 3,
            "min_instances": 2,
            "max_instances": 10,
            "cpu_percent": 78.5,
            "memory_percent": 62.0,
            "request_rate": 850.0,
            "latency_ms": 280.0,
            "cost_per_instance_hour": 2.00,
            "traffic_trend": TrafficTrend.RISING,
            "observed_at": now,
            "recent_events": [
                {
                    "timestamp": now,
                    "event_type": "warning",
                    "message": "Traffic surge detected; latency approaching SLO limit."
                }
            ],
            "failure_simulation_enabled": False,
            "peak_rps": 920.0,
            "error_rate_percent": 0.8,
            "checks_passing": 5,
            "checks_total": 5,
            "active_alerts": ["TrafficSurgeWarning", "ApproachingLatencySLO"],
        },
        "analytics-pipeline": {
            "service_id": "analytics-pipeline",
            "name": "Event Stream Analytics Pipeline",
            "description": "Real-time streaming ingestion and metric rollups",
            "status": "healthy",
            "health": HealthStatus.HEALTHY,
            "instances": 6,
            "min_instances": 2,
            "max_instances": 12,
            "cpu_percent": 45.0,
            "memory_percent": 55.0,
            "request_rate": 320.0,
            "latency_ms": 180.0,
            "cost_per_instance_hour": 1.25,
            "traffic_trend": TrafficTrend.STABLE,
            "observed_at": now,
            "recent_events": [
                {
                    "timestamp": now,
                    "event_type": "info",
                    "message": "Stream processing healthy across all partitions."
                }
            ],
            "failure_simulation_enabled": False,
            "peak_rps": 400.0,
            "error_rate_percent": 0.05,
            "checks_passing": 5,
            "checks_total": 5,
            "active_alerts": [],
        },
        "payment-processor": {
            "service_id": "payment-processor",
            "name": "Payment Gateway & Settlement Processor",
            "description": "Critical transactional payments gateway",
            "status": "healthy",
            "health": HealthStatus.HEALTHY,
            "instances": 2,
            "min_instances": 2,
            "max_instances": 8,
            "cpu_percent": 22.0,
            "memory_percent": 30.0,
            "request_rate": 45.0,
            "latency_ms": 95.0,
            "cost_per_instance_hour": 2.50,
            "traffic_trend": TrafficTrend.STABLE,
            "observed_at": now,
            "recent_events": [
                {
                    "timestamp": now,
                    "event_type": "info",
                    "message": "PCI-DSS compliance heartbeats verified."
                }
            ],
            "failure_simulation_enabled": False,
            "peak_rps": 60.0,
            "error_rate_percent": 0.0,
            "checks_passing": 5,
            "checks_total": 5,
            "active_alerts": [],
        }
    }


def get_stale_observation_for(service_id: str, current_state: Dict[str, Any]) -> ServiceMetrics:
    """
    Simulates an outdated observation from 45 minutes ago.
    """
    past_time = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
    if service_id == "analytics-pipeline":
        return ServiceMetrics(
            service_id=service_id,
            cpu_percent=12.0,
            memory_percent=20.0,
            request_rate=15.0,
            latency_ms=75.0,
            observed_at=past_time
        )
    elif service_id == "auth-api":
        return ServiceMetrics(
            service_id=service_id,
            cpu_percent=25.0,
            memory_percent=30.0,
            request_rate=110.0,
            latency_ms=90.0,
            observed_at=past_time
        )
    else:
        return ServiceMetrics(
            service_id=service_id,
            cpu_percent=max(5.0, current_state.get("cpu_percent", 10.0) * 0.3),
            memory_percent=max(10.0, current_state.get("memory_percent", 15.0) * 0.5),
            request_rate=max(0.0, current_state.get("request_rate", 0.0) * 0.2),
            latency_ms=max(50.0, current_state.get("latency_ms", 100.0) * 0.6),
            observed_at=past_time
        )
