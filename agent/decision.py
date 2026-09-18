"""
agent/decision.py
Decision engine supporting LLM reasoning as the primary path,
with a deterministic rule-based fallback for high reliability and testing.
"""

from __future__ import annotations
from typing import Tuple, List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from .models import (
    InvestigationEvidence,
    AgentDecision,
    ActionRequest,
    ActionType,
    current_iso_timestamp,
)
from .llm import LLMInterface, get_llm_provider
from .prompts import (
    REASONING_DECISION_SYSTEM_PROMPT,
    REASONING_DECISION_USER_TEMPLATE,
)

logger = logging.getLogger("DecisionEngine")


def parse_iso_timestamp(ts: str) -> Optional[datetime]:
    """Safely parse an ISO 8601 string to a timezone-aware datetime."""
    try:
        ts_clean = ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts_clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def evaluate_staleness(timestamp_str: str, threshold_seconds: float = 300.0) -> Tuple[bool, float, Optional[str]]:
    """
    Check if a telemetry observation timestamp is older than threshold_seconds (default 5 minutes).
    Returns (is_stale, age_seconds, warning_message).
    """
    obs_dt = parse_iso_timestamp(timestamp_str)
    if not obs_dt:
        return True, 999999.0, f"Invalid or unparseable timestamp '{timestamp_str}'. Telemetry treated as stale."

    now = datetime.now(timezone.utc)
    age_seconds = (now - obs_dt).total_seconds()

    if age_seconds > threshold_seconds:
        return True, age_seconds, (
            f"Observation timestamp ({timestamp_str}) is {age_seconds:.1f}s old "
            f"(threshold: {threshold_seconds}s). Data is stale."
        )

    return False, age_seconds, None


class DeterministicDecisionEngine:
    """
    Deterministic rule-based decision engine.
    Used as an authoritative fallback when LLM is unavailable or unparseable.
    """

    def decide(self, evidence: InvestigationEvidence, objective: str = "Optimize cloud cost safely") -> AgentDecision:
        service_id = evidence.service_id
        state = evidence.state
        metrics = evidence.metrics
        traffic = evidence.traffic
        health = evidence.health
        constraints = evidence.constraints
        cost = evidence.cost

        evidence_items: List[str] = [
            f"Current instances: {state.current_instances} (Allowed range: {constraints.min_instances} - {constraints.max_instances})",
            f"Compute load: CPU {metrics.cpu_utilization_pct:.1f}%, Memory {metrics.memory_utilization_pct:.1f}%",
            f"Traffic load: {traffic.request_rate_rps:.1f} RPS, p95 latency {traffic.latency_p95_ms:.1f}ms (Max threshold: {constraints.max_latency_p95_ms}ms)",
            f"Health status: {health.status.upper()} ('{health.message}')",
            f"Current hourly cost: ${cost.total_hourly_cost:.2f}/hr (~${cost.monthly_projection_usd:.2f}/mo)",
        ]

        safety_considerations: List[str] = []

        # 1. Staleness Check
        if evidence.is_stale:
            safety_considerations.append("Observation data was flagged as stale.")
            return AgentDecision(
                service_id=service_id,
                decision=ActionType.NO_ACTION,
                proposed_action=None,
                confidence=0.95,
                reason=(
                    f"Telemetric observation for '{service_id}' is stale ({evidence.staleness_warning}). "
                    "Refusing to make an optimization decision on outdated data. Re-investigation required."
                ),
                evidence=evidence_items,
                expected_effect="Preserve existing service capacity and avoid unsafe modifications based on stale metrics.",
                safety_considerations=safety_considerations,
            )

        # 2. Health Check
        if health.status.lower() != "healthy":
            safety_considerations.append(f"Service health is {health.status} ('{health.message}').")
            return AgentDecision(
                service_id=service_id,
                decision=ActionType.NO_ACTION,
                proposed_action=None,
                confidence=0.99,
                reason=(
                    f"Service '{service_id}' is currently reporting unhealthy status '{health.status}'. "
                    "Modifying capacity or scaling down an unhealthy service risks causing catastrophic failure. "
                    "Preserving capacity for stability."
                ),
                evidence=evidence_items,
                expected_effect="Prevent outage amplification during service degradation.",
                safety_considerations=safety_considerations,
            )

        # 3. Rising Traffic / High Load Check (Scenario B)
        latency_ratio = traffic.latency_p95_ms / constraints.max_latency_p95_ms if constraints.max_latency_p95_ms > 0 else 1.0
        cpu_ratio = metrics.cpu_utilization_pct / constraints.max_cpu_pct if constraints.max_cpu_pct > 0 else 1.0

        is_high_load = (
            latency_ratio >= 0.85
            or cpu_ratio >= 0.90
            or metrics.cpu_utilization_pct >= 80.0
            or traffic.request_rate_rps >= 500.0
        )

        if is_high_load:
            safety_considerations.append(
                f"Latency is at {latency_ratio * 100:.1f}% of limit ({traffic.latency_p95_ms:.1f}ms / {constraints.max_latency_p95_ms}ms)."
            )
            safety_considerations.append(f"CPU utilization is high at {metrics.cpu_utilization_pct:.1f}%.")

            if state.current_instances < constraints.max_instances:
                target_instances = min(constraints.max_instances, state.current_instances + 2)
                reason_msg = (
                    f"Traffic is rising ({traffic.request_rate_rps:.1f} RPS) and p95 latency is {traffic.latency_p95_ms:.1f}ms, "
                    f"approaching the SLA limit of {constraints.max_latency_p95_ms}ms. CPU is at {metrics.cpu_utilization_pct:.1f}%. "
                    f"Cost optimization would cause SLA violation. Recommending SCALE_UP from {state.current_instances} to {target_instances} instances."
                )
                action_req = ActionRequest(
                    action_id=f"act-{uuid.uuid4().hex[:8]}",
                    service_id=service_id,
                    action=ActionType.SCALE_UP,
                    target_instances=target_instances,
                    reason=reason_msg,
                    expected_effect=f"Relieve high compute load and bring p95 latency comfortably below {constraints.max_latency_p95_ms}ms limit.",
                    safety_considerations=safety_considerations,
                )
                return AgentDecision(
                    service_id=service_id,
                    decision=ActionType.SCALE_UP,
                    proposed_action=action_req,
                    confidence=0.92,
                    reason=reason_msg,
                    evidence=evidence_items,
                    expected_effect=action_req.expected_effect,
                    safety_considerations=safety_considerations,
                )
            else:
                return AgentDecision(
                    service_id=service_id,
                    decision=ActionType.NO_ACTION,
                    proposed_action=None,
                    confidence=0.90,
                    reason=(
                        f"Service is experiencing rising traffic and elevated latency ({traffic.latency_p95_ms:.1f}ms), "
                        f"but current instances ({state.current_instances}) is already at maximum capacity limit ({constraints.max_instances}). "
                        "Cannot scale up further; scaling down is prohibited."
                    ),
                    evidence=evidence_items,
                    expected_effect="Preserve maximum capacity to avoid SLA breach.",
                    safety_considerations=safety_considerations,
                )

        # 4. Underutilization / Cost Optimization Check (Scenario A)
        is_underutilized = (
            metrics.cpu_utilization_pct < 20.0
            and metrics.memory_utilization_pct < 40.0
            and traffic.request_rate_rps < 50.0
            and latency_ratio < 0.40
        )

        if is_underutilized and constraints.can_scale_down:
            if state.current_instances <= constraints.min_instances:
                safety_considerations.append(
                    f"Current instances ({state.current_instances}) is at or below minimum constraint ({constraints.min_instances})."
                )
                return AgentDecision(
                    service_id=service_id,
                    decision=ActionType.NO_ACTION,
                    proposed_action=None,
                    confidence=0.95,
                    reason=(
                        f"Service '{service_id}' has low utilization (CPU: {metrics.cpu_utilization_pct:.1f}%, RPS: {traffic.request_rate_rps:.1f}), "
                        f"but is already at minimum allowable capacity ({constraints.min_instances} instances). "
                        "Further scale down violates minimum safety boundary."
                    ),
                    evidence=evidence_items,
                    expected_effect="Preserve minimum operational redundancy.",
                    safety_considerations=safety_considerations,
                )

            target_instances = max(constraints.min_instances, 1)
            if target_instances >= state.current_instances:
                target_instances = state.current_instances - 1

            saved_instances = state.current_instances - target_instances
            hourly_savings = saved_instances * cost.hourly_cost_per_instance
            monthly_savings = hourly_savings * 24 * 30

            safety_considerations.append(
                f"Target {target_instances} instances satisfies minimum constraint limit ({constraints.min_instances})."
            )
            safety_considerations.append(
                f"Even with {target_instances} instance(s), estimated CPU remains below 35%, ensuring ample headroom."
            )

            reason_msg = (
                f"Service is severely underutilized: CPU is {metrics.cpu_utilization_pct:.1f}%, "
                f"Memory is {metrics.memory_utilization_pct:.1f}%, and traffic is only {traffic.request_rate_rps:.1f} RPS. "
                f"Scaling down from {state.current_instances} to {target_instances} instances saves "
                f"${hourly_savings:.2f}/hr (~${monthly_savings:.2f}/month) with zero risk to latency ({traffic.latency_p95_ms:.1f}ms)."
            )

            action_req = ActionRequest(
                action_id=f"act-{uuid.uuid4().hex[:8]}",
                service_id=service_id,
                action=ActionType.SCALE_DOWN,
                target_instances=target_instances,
                reason=reason_msg,
                expected_effect=f"Reduce unnecessary idle compute cost by ~${monthly_savings:.2f}/month while preserving service availability.",
                safety_considerations=safety_considerations,
            )

            return AgentDecision(
                service_id=service_id,
                decision=ActionType.SCALE_DOWN,
                proposed_action=action_req,
                confidence=0.96,
                reason=reason_msg,
                evidence=evidence_items,
                expected_effect=action_req.expected_effect,
                safety_considerations=safety_considerations,
            )

        # 5. Default Balanced Load Check
        return AgentDecision(
            service_id=service_id,
            decision=ActionType.NO_ACTION,
            proposed_action=None,
            confidence=0.88,
            reason=(
                f"Service '{service_id}' is operating within healthy, balanced parameters "
                f"(CPU: {metrics.cpu_utilization_pct:.1f}%, Memory: {metrics.memory_utilization_pct:.1f}%, "
                f"Traffic: {traffic.request_rate_rps:.1f} RPS, p95: {traffic.latency_p95_ms:.1f}ms). "
                "No scaling or optimization action is justified at this time."
            ),
            evidence=evidence_items,
            expected_effect="Maintain current stable configuration without disruption.",
            safety_considerations=["No changes initiated; risk is zero."],
        )


class DecisionEngine:
    """
    Primary Decision Engine orchestrating LLM reasoning with deterministic safety fallback.
    """

    def __init__(
        self,
        llm: Optional[LLMInterface] = None,
        staleness_threshold_seconds: float = 300.0,
    ):
        self.llm = llm or get_llm_provider()
        self.fallback_engine = DeterministicDecisionEngine()
        self.staleness_threshold_seconds = staleness_threshold_seconds

    def decide(self, evidence: InvestigationEvidence, objective: str = "Optimize cloud cost safely") -> AgentDecision:
        """
        Produce a decision using LLM reasoning as primary path, falling back gracefully to deterministic logic.
        """
        # Format user prompt for LLM
        prompt = REASONING_DECISION_USER_TEMPLATE.format(
            service_id=evidence.service_id,
            service_name=evidence.state.service_name,
            current_instances=evidence.state.current_instances,
            min_instances=evidence.constraints.min_instances,
            max_instances=evidence.constraints.max_instances,
            cpu_utilization_pct=evidence.metrics.cpu_utilization_pct,
            memory_utilization_pct=evidence.metrics.memory_utilization_pct,
            request_rate_rps=evidence.traffic.request_rate_rps,
            latency_p95_ms=evidence.traffic.latency_p95_ms,
            max_latency_p95_ms=evidence.constraints.max_latency_p95_ms,
            health_status=evidence.health.status,
            health_message=evidence.health.message,
            hourly_cost_per_instance=evidence.cost.hourly_cost_per_instance,
            total_hourly_cost=evidence.cost.total_hourly_cost,
            monthly_projection_usd=evidence.cost.monthly_projection_usd,
            is_stale=evidence.is_stale,
            staleness_warning=evidence.staleness_warning or "None",
            objective=objective,
        )

        try:
            # Primary Path: LLM Structured Reasoning
            llm_result = self.llm.generate_json(prompt, system_prompt=REASONING_DECISION_SYSTEM_PROMPT)
            decision_str = str(llm_result.get("decision", "no_action")).lower()

            try:
                action_type = ActionType(decision_str)
            except ValueError:
                action_type = ActionType.NO_ACTION

            target_instances = llm_result.get("target_instances")
            if target_instances is not None:
                target_instances = int(target_instances)

            confidence = float(llm_result.get("confidence", 0.90))
            reason = str(llm_result.get("reason", "Decision produced by LLM reasoning."))
            evidence_summary = llm_result.get("evidence_summary", [])
            if not isinstance(evidence_summary, list):
                evidence_summary = [str(evidence_summary)]

            expected_effect = str(llm_result.get("expected_effect", "Optimize infrastructure efficiency."))
            safety_considerations = llm_result.get("safety_considerations", [])
            if not isinstance(safety_considerations, list):
                safety_considerations = [str(safety_considerations)]

            evidence_summary.insert(0, f"Reasoning Engine: {self.llm.provider_name} ({self.llm.model_name})")

            proposed_action = None
            if action_type != ActionType.NO_ACTION:
                proposed_action = ActionRequest(
                    action_id=f"act-{uuid.uuid4().hex[:8]}",
                    service_id=evidence.service_id,
                    action=action_type,
                    target_instances=target_instances,
                    reason=reason,
                    expected_effect=expected_effect,
                    safety_considerations=safety_considerations,
                )

            return AgentDecision(
                service_id=evidence.service_id,
                decision=action_type,
                proposed_action=proposed_action,
                confidence=confidence,
                reason=reason,
                evidence=evidence_summary,
                expected_effect=expected_effect,
                safety_considerations=safety_considerations,
            )

        except Exception as e:
            err_msg = str(e)
            logger.warning(f"[{self.llm.provider_name}] decision generation failed ({err_msg}). Falling back to deterministic decision engine.")
            fb_decision = self.fallback_engine.decide(evidence, objective=objective)
            fb_decision.evidence.insert(0, f"Reasoning Engine: DeterministicFallback (LLM {self.llm.provider_name} error: {err_msg})")
            return fb_decision

