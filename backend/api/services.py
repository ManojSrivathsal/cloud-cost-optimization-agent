from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from backend.models import (
    ServiceConstraints,
    ServiceCost,
    ServiceDetail,
    ServiceHealth,
    ServiceMetrics,
    ServiceOverview,
    ServiceTraffic,
    StaleObservationResponse,
)
from backend.simulator.cloud import simulator

router = APIRouter(prefix="/api/services", tags=["Services"])


@router.get("", response_model=Dict[str, List[ServiceOverview]])
def list_services() -> Dict[str, List[ServiceOverview]]:
    """
    List all simulated cloud services with overview status, health, and cost.
    """
    services = simulator.list_services()
    return {"services": services}


@router.get("/{service_id}", response_model=ServiceDetail)
def get_service(service_id: str) -> ServiceDetail:
    """
    Get comprehensive details for a specific cloud service.
    """
    service = simulator.get_service(service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return service


@router.get("/{service_id}/metrics", response_model=ServiceMetrics)
def get_service_metrics(service_id: str) -> ServiceMetrics:
    """
    Get current real-time metrics (CPU, Memory, Request Rate, Latency, Timestamp).
    """
    metrics = simulator.get_metrics(service_id)
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return metrics


@router.get("/{service_id}/traffic", response_model=ServiceTraffic)
def get_service_traffic(service_id: str) -> ServiceTraffic:
    """
    Get traffic telemetry, request rate, peak RPS, error rate, and trend (stable/rising/spiking).
    """
    traffic = simulator.get_traffic(service_id)
    if not traffic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return traffic


@router.get("/{service_id}/health", response_model=ServiceHealth)
def get_service_health(service_id: str) -> ServiceHealth:
    """
    Get service health status, health checks passing, and active alert notifications.
    """
    health = simulator.get_health(service_id)
    if not health:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return health


@router.get("/{service_id}/cost", response_model=ServiceCost)
def get_service_cost(service_id: str) -> ServiceCost:
    """
    Get simulated billing telemetry: hourly rate, daily projection, and monthly projection.
    """
    cost = simulator.get_cost(service_id)
    if not cost:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return cost


@router.get("/{service_id}/constraints", response_model=ServiceConstraints)
def get_service_constraints(service_id: str) -> ServiceConstraints:
    """
    Get capacity and safety boundaries (min_instances, max_instances, latency limits).
    """
    constraints = simulator.get_constraints(service_id)
    if not constraints:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return constraints


@router.get("/{service_id}/stale-observation", response_model=StaleObservationResponse)
def get_stale_observation(service_id: str) -> StaleObservationResponse:
    """
    Retrieve an outdated observation snapshot (45m prior) compared with live state.
    Designed for Scenario C demonstration.
    """
    stale_resp = simulator.get_stale_observation(service_id)
    if not stale_resp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_id}' not found.",
        )
    return stale_resp
