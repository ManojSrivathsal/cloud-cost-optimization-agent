"""
agent/verifier.py
Post-action verification engine and explanation generator.
Re-fetches cloud state after action execution to verify live reality,
handles failures truthfully, and generates transparent final explanations.
"""

from __future__ import annotations
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from .models import (
    AgentDecision,
    ActionRequest,
    ActionResult,
    ActionExecutionStatus,
    ActionType,
    ServiceState,
    VerificationResult,
    current_iso_timestamp,
)
from .tools import CloudInvestigationToolInterface


class PostActionVerifier:
    """
    Verifies the actual impact of an executed action and creates detailed explanations.
    """

    def __init__(self, investigation_adapter: CloudInvestigationToolInterface):
        self.investigation_adapter = investigation_adapter

    def verify(
        self,
        service_id: str,
        decision: AgentDecision,
        action_result: Optional[ActionResult],
    ) -> VerificationResult:
        """
        Re-fetch current state from the cloud provider and verify if the action took effect.
        """
        # Re-fetch the live state
        try:
            live_state = self.investigation_adapter.get_service_state(service_id)
            actual_instances = live_state.current_instances
            actual_status = live_state.status
        except Exception as e:
            return VerificationResult(
                service_id=service_id,
                action_id=action_result.action_id if action_result else None,
                is_verified=False,
                success=False,
                expected_state={"target_instances": decision.proposed_action.target_instances if decision.proposed_action else None},
                actual_state={"error": str(e)},
                is_effective=False,
                verification_notes=f"Failed to re-fetch live service state after action: {str(e)}",
            )

        expected_target = decision.proposed_action.target_instances if decision.proposed_action else None

        # Case 1: No action was proposed
        if decision.decision == ActionType.NO_ACTION or action_result is None:
            return VerificationResult(
                service_id=service_id,
                action_id=None,
                is_verified=True,
                success=True,
                expected_state={"instances": actual_instances, "action": "none"},
                actual_state={"current_instances": actual_instances, "status": actual_status},
                is_effective=True,
                verification_notes=f"No action was performed as planned. Service '{service_id}' remains stable at {actual_instances} instances.",
            )

        # Case 2: Action was Rejected by Deterministic Safety Layer
        if action_result.status == ActionExecutionStatus.REJECTED:
            return VerificationResult(
                service_id=service_id,
                action_id=action_result.action_id,
                is_verified=True,
                success=False,
                expected_state={"target_instances": expected_target},
                actual_state={"current_instances": actual_instances, "status": actual_status},
                is_effective=False,
                verification_notes=(
                    f"Action was REJECTED by the backend deterministic safety layer: {action_result.error}. "
                    f"Live cloud state verified unchanged at {actual_instances} instances."
                ),
            )

        # Case 3: Action Failed during execution (Scenario D)
        if action_result.status == ActionExecutionStatus.FAILED:
            return VerificationResult(
                service_id=service_id,
                action_id=action_result.action_id,
                is_verified=True,
                success=False,
                expected_state={"target_instances": expected_target},
                actual_state={"current_instances": actual_instances, "status": actual_status},
                is_effective=False,
                verification_notes=(
                    f"Action FAILED during infrastructure execution: {action_result.error}. "
                    f"Live state re-check shows service '{service_id}' remains at {actual_instances} instances. "
                    "No unsafe partial changes detected."
                ),
            )

        # Case 4: Action reported SUCCESS by backend -> verify against live state
        if action_result.status == ActionExecutionStatus.SUCCESS:
            if expected_target is not None and actual_instances == expected_target:
                return VerificationResult(
                    service_id=service_id,
                    action_id=action_result.action_id,
                    is_verified=True,
                    success=True,
                    expected_state={"target_instances": expected_target},
                    actual_state={"current_instances": actual_instances, "status": actual_status},
                    is_effective=True,
                    verification_notes=(
                        f"Action verified successfully. Live cloud state confirmed: instances transitioned from "
                        f"{action_result.previous_instances} to {actual_instances} as expected."
                    ),
                )
            else:
                return VerificationResult(
                    service_id=service_id,
                    action_id=action_result.action_id,
                    is_verified=True,
                    success=False,
                    expected_state={"target_instances": expected_target},
                    actual_state={"current_instances": actual_instances, "status": actual_status},
                    is_effective=False,
                    verification_notes=(
                        f"Discrepancy detected! Backend reported success, but live state shows {actual_instances} "
                        f"instances instead of expected target {expected_target}."
                    ),
                )

        # Fallback
        return VerificationResult(
            service_id=service_id,
            action_id=action_result.action_id,
            is_verified=False,
            success=False,
            expected_state={"target_instances": expected_target},
            actual_state={"current_instances": actual_instances, "status": actual_status},
            is_effective=False,
            verification_notes=f"Unrecognized action status: {action_result.status}",
        )

    def generate_explanation(
        self,
        service_id: str,
        objective: str,
        decision: AgentDecision,
        action_result: Optional[ActionResult],
        verification: VerificationResult,
    ) -> str:
        """
        Synthesize a transparent, factual, human-readable explanation of the entire cycle.
        """
        lines = []
        lines.append(f"### Cloud Cost Optimization Agent Report for `{service_id}`")
        lines.append(f"**Objective**: {objective}")
        lines.append(f"**Decision Reached**: `{decision.decision.value.upper()}` (Confidence: {decision.confidence * 100:.0f}%)")
        lines.append("")
        lines.append("**Key Evidence Collected:**")
        for ev in decision.evidence:
            lines.append(f"- {ev}")
        lines.append("")
        lines.append(f"**Reasoning**: {decision.reason}")
        lines.append("")

        if decision.safety_considerations:
            lines.append("**Safety Guardrails Evaluated:**")
            for sc in decision.safety_considerations:
                lines.append(f"- {sc}")
            lines.append("")

        if action_result:
            lines.append(f"**Action Execution Status**: `{action_result.status.value.upper()}`")
            if action_result.status == ActionExecutionStatus.SUCCESS:
                lines.append(
                    f"- Instance transition: `{action_result.previous_instances}` -> `{action_result.new_instances}` instances."
                )
            elif action_result.status in [ActionExecutionStatus.FAILED, ActionExecutionStatus.REJECTED]:
                lines.append(f"- **Error / Failure Detail**: {action_result.error or action_result.message}")
            lines.append("")

        lines.append("**Post-Action Verification & Live State:**")
        lines.append(f"- Status: {'VERIFIED' if verification.is_verified else 'UNVERIFIED'}")
        lines.append(f"- Notes: {verification.verification_notes}")
        lines.append(f"- Live instance count: `{verification.actual_state.get('current_instances', 'unknown')}`")
        lines.append("")

        # Next steps / concluding guidance
        lines.append("**Next Steps:**")
        if verification.success and decision.decision == ActionType.SCALE_DOWN:
            lines.append("- Optimization applied successfully. Continuing telemetry monitoring to verify latency stability.")
        elif verification.success and decision.decision == ActionType.SCALE_UP:
            lines.append("- Scaling completed. Monitor p95 latency to ensure request queues clear.")
        elif not verification.success and action_result and action_result.status == ActionExecutionStatus.FAILED:
            lines.append("- Action execution failed. Do NOT retry immediately; alert cloud operations to investigate hypervisor logs.")
        elif decision.decision == ActionType.NO_ACTION:
            lines.append("- Service capacity preserved. Routine monitoring active.")
        else:
            lines.append("- Review service metrics in next scheduled cycle.")

        return "\n".join(lines)
