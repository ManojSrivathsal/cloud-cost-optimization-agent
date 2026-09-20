from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from backend.models import (
    ActionRecord,
    ActionRequest,
    ActionResponse,
    ActionStatus,
    ActionVerification,
)
from backend.safety.engine import safety_engine
from backend.simulator.cloud import simulator

router = APIRouter(prefix="/api/actions", tags=["Actions"])


@router.post("", response_model=ActionResponse)
def create_action(request: ActionRequest) -> ActionResponse:
    """
    Submit an optimization action request.

    Deterministic Process:
    1. Check service exists.
    2. Pass request and live state to Deterministic Safety Engine.
    3. If safety checks FAIL: record rejected action, do NOT alter state, return status='rejected'.
    4. If safety checks PASS: execute action (or simulate provider failure if active), return status='success' or 'failed'.
    """
    # 1. Check service exists
    service = simulator.services.get(request.service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{request.service_id}' does not exist.",
        )

    # 2. Evaluate with Deterministic Safety Engine
    validation = safety_engine.validate_action(request, service)

    # 3. Handle Rejection
    if not validation.is_safe:
        record = simulator.record_rejected_action(
            service_id=request.service_id,
            action=request.action,
            target_instances=request.target_instances,
            reason=request.reason,
            violations=validation.violations,
        )
        return ActionResponse(
            action_id=record.action_id,
            status=ActionStatus.REJECTED,
            service_id=record.service_id,
            action=record.action,
            previous_instances=record.previous_instances,
            new_instances=record.new_instances,
            reason=validation.reason,
            safety_violations=record.safety_violations,
            execution_error=None,
        )

    # 4. Execute Action
    record = simulator.execute_action(
        service_id=request.service_id,
        action=request.action,
        target_instances=request.target_instances,
        reason=request.reason,
    )

    return ActionResponse(
        action_id=record.action_id,
        status=record.status,
        service_id=record.service_id,
        action=record.action,
        previous_instances=record.previous_instances,
        new_instances=record.new_instances,
        reason=request.reason if record.status == ActionStatus.SUCCESS else None,
        safety_violations=[],
        execution_error=record.execution_error,
    )


@router.get("", response_model=Dict[str, List[ActionRecord]])
def list_actions() -> Dict[str, List[ActionRecord]]:
    """
    List all executed, rejected, and failed actions.
    """
    return {"actions": simulator.list_actions()}


@router.get("/{action_id}", response_model=ActionRecord)
def get_action(action_id: str) -> ActionRecord:
    """
    Get detailed record for an action.
    """
    record = simulator.get_action(action_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found.",
        )
    return record


@router.get("/{action_id}/verify", response_model=ActionVerification)
def verify_action(action_id: str) -> ActionVerification:
    """
    Verify post-action state.
    Checks whether target capacity was achieved, confirms previous and current instances,
    and returns post-action telemetry and cost savings.
    """
    verification = simulator.verify_action(action_id)
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found for verification.",
        )
    return verification
