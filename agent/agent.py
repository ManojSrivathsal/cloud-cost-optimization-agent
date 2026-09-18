"""
agent/agent.py
Autonomous Cloud Cost Optimization Agent Orchestrator.
Primary reasoning path: LLM (Gemini / OpenAI / LocalSimulatedLLM)
Reliability fallback: Deterministic reasoning engine
Authoritative execution guard: Deterministic backend safety layer

Coordinates:
NLU UNDERSTANDING -> INVESTIGATION PLANNING -> TOOL SELECTION -> REASONING & DECISION
-> BACKEND SAFETY VALIDATION -> ACTION EXECUTION -> LIVE STATE RE-CHECK -> VERIFICATION -> EXPLANATION
"""

from __future__ import annotations
from typing import Optional, Dict, Any, List
import uuid
import logging

from .models import (
    ServiceState,
    ServiceMetrics,
    ServiceTraffic,
    ServiceHealth,
    ServiceConstraints,
    ServiceCost,
    InvestigationEvidence,
    ActionType,
    ActionRequest,
    ActionResult,
    ActionExecutionStatus,
    AgentDecision,
    VerificationResult,
    AgentExecutionResult,
    TimelineEvent,
    current_iso_timestamp,
)
from .tools import (
    CloudInvestigationToolInterface,
    CloudActionExecutionInterface,
    ToolRegistry,
)
from .decision import DecisionEngine, evaluate_staleness
from .verifier import PostActionVerifier
from .llm import LLMInterface, get_llm_provider
from .prompts import (
    NLU_INTENT_SYSTEM_PROMPT,
    NLU_INTENT_USER_TEMPLATE,
    POST_ACTION_EXPLANATION_SYSTEM_PROMPT,
    POST_ACTION_EXPLANATION_USER_TEMPLATE,
)

logger = logging.getLogger("CloudCostOptimizationAgent")


class CloudCostOptimizationAgent:
    """
    Autonomous Decision Engine and Orchestrator for cloud cost optimization.
    """

    def __init__(
        self,
        investigation_adapter: CloudInvestigationToolInterface,
        action_adapter: CloudActionExecutionInterface,
        llm: Optional[LLMInterface] = None,
        staleness_threshold_seconds: float = 300.0,
    ):
        self.investigation_adapter = investigation_adapter
        self.action_adapter = action_adapter
        self.tool_registry = ToolRegistry(investigation_adapter, action_adapter)
        self.llm = llm or get_llm_provider()
        self.staleness_threshold_seconds = staleness_threshold_seconds
        self.decision_engine = DecisionEngine(llm=self.llm, staleness_threshold_seconds=staleness_threshold_seconds)
        self.verifier = PostActionVerifier(investigation_adapter)

    def parse_natural_language_request(
        self,
        user_request: str,
        default_service_id: str = "reports-worker",
        timeline: Optional[List[TimelineEvent]] = None,
    ) -> Dict[str, Any]:
        """
        Uses LLM natural-language understanding to extract target service and optimization goal.
        """
        if timeline is None:
            timeline = []

        prompt = NLU_INTENT_USER_TEMPLATE.format(
            user_request=user_request,
            default_service_id=default_service_id,
        )

        try:
            parsed = self.llm.generate_json(prompt, system_prompt=NLU_INTENT_SYSTEM_PROMPT)
            service_id = parsed.get("service_id") or default_service_id
            objective = parsed.get("objective") or user_request
            tools = parsed.get("required_investigation_tools") or [
                "get_service_state",
                "get_service_metrics",
                "get_service_traffic",
                "get_service_health",
                "get_service_constraints",
                "get_service_cost",
            ]
        except Exception as e:
            logger.warning(f"LLM NLU parsing failed ({str(e)}). Falling back to default intent extraction.")
            service_id = default_service_id
            objective = user_request
            tools = [
                "get_service_state",
                "get_service_metrics",
                "get_service_traffic",
                "get_service_health",
                "get_service_constraints",
                "get_service_cost",
            ]

        timeline.append(
            TimelineEvent(
                step="Natural-Language Understanding",
                description=f"Identified target service '{service_id}' with objective: '{objective}'. [NLU -> {self.llm.provider_name}]",
                data={"service_id": service_id, "objective": objective, "planned_tools": tools, "llm_provider": self.llm.provider_name},
            )
        )

        return {"service_id": service_id, "objective": objective, "tools": tools}

    def investigate(
        self,
        service_id: str,
        initial_observation: Optional[Dict[str, Any]] = None,
        planned_tools: Optional[List[str]] = None,
        timeline: Optional[List[TimelineEvent]] = None,
    ) -> InvestigationEvidence:
        """
        Executes investigation tools, collects telemetry, and detects stale observations.
        """
        if timeline is None:
            timeline = []

        is_stale = False
        staleness_warning = None

        # Check staleness of initial observation if supplied
        if initial_observation and "timestamp" in initial_observation:
            is_stale, age, warning = evaluate_staleness(
                initial_observation["timestamp"],
                threshold_seconds=self.staleness_threshold_seconds,
            )
            if is_stale:
                staleness_warning = warning
                timeline.append(
                    TimelineEvent(
                        step="Stale Data Detection",
                        description=f"Initial observation for '{service_id}' is stale ({warning}). Re-fetching fresh live telemetry.",
                        data={"initial_observation": initial_observation, "age_seconds": age},
                    )
                )

        timeline.append(
            TimelineEvent(
                step="Investigation Started",
                description=f"Executing investigation tools for service '{service_id}'.",
                data={"tools": planned_tools or "all_telemetry_tools"},
            )
        )

        # Tool calling via ToolRegistry
        state = self.tool_registry.execute("get_service_state", service_id=service_id)
        metrics = self.tool_registry.execute("get_service_metrics", service_id=service_id)
        traffic = self.tool_registry.execute("get_service_traffic", service_id=service_id)
        health = self.tool_registry.execute("get_service_health", service_id=service_id)
        constraints = self.tool_registry.execute("get_service_constraints", service_id=service_id)
        cost = self.tool_registry.execute("get_service_cost", service_id=service_id)

        # Check live metrics timestamp for staleness
        live_is_stale, live_age, live_warning = evaluate_staleness(
            metrics.timestamp,
            threshold_seconds=self.staleness_threshold_seconds,
        )
        if live_is_stale:
            is_stale = True
            staleness_warning = live_warning

        timeline.append(
            TimelineEvent(
                step="Evidence Collected",
                description=(
                    f"Telemetry gathered: {state.current_instances} instances, CPU: {metrics.cpu_utilization_pct:.1f}%, "
                    f"Traffic: {traffic.request_rate_rps:.1f} RPS, Latency p95: {traffic.latency_p95_ms:.1f}ms, Health: {health.status}."
                ),
                data={
                    "current_instances": state.current_instances,
                    "cpu_pct": metrics.cpu_utilization_pct,
                    "rps": traffic.request_rate_rps,
                    "p95_ms": traffic.latency_p95_ms,
                    "health": health.status,
                    "hourly_cost": cost.total_hourly_cost,
                },
            )
        )

        return InvestigationEvidence(
            service_id=service_id,
            state=state,
            metrics=metrics,
            traffic=traffic,
            health=health,
            constraints=constraints,
            cost=cost,
            is_stale=is_stale,
            staleness_warning=staleness_warning,
            collected_at=current_iso_timestamp(),
            raw_data={
                "state": state.to_dict(),
                "metrics": metrics.to_dict(),
                "traffic": traffic.to_dict(),
                "health": health.to_dict(),
                "constraints": constraints.to_dict(),
                "cost": cost.to_dict(),
            },
        )

    def decide(
        self,
        evidence: InvestigationEvidence,
        objective: str = "Optimize cost safely",
        timeline: Optional[List[TimelineEvent]] = None,
    ) -> AgentDecision:
        """
        Reasons over evidence using LLM as primary path (with deterministic fallback).
        """
        if timeline is None:
            timeline = []

        timeline.append(
            TimelineEvent(
                step="LLM Reasoning & Decision",
                description=f"Running LLM decision reasoning against evidence for objective: '{objective}'.",
            )
        )

        decision = self.decision_engine.decide(evidence, objective=objective)

        timeline.append(
            TimelineEvent(
                step="Decision Reached",
                description=f"Selected decision: {decision.decision.value.upper()}. Reason: {decision.reason} [Decision -> {self.llm.provider_name}]",
                data={
                    "decision": decision.decision.value,
                    "target_instances": decision.proposed_action.target_instances if decision.proposed_action else None,
                    "confidence": decision.confidence,
                    "llm_provider": self.llm.provider_name,
                },
            )
        )

        return decision

    def execute_action(
        self,
        decision: AgentDecision,
        timeline: Optional[List[TimelineEvent]] = None,
    ) -> Optional[ActionResult]:
        """
        Submits proposed action to backend execution & safety layer.
        """
        if timeline is None:
            timeline = []

        if decision.decision == ActionType.NO_ACTION or not decision.proposed_action:
            timeline.append(
                TimelineEvent(
                    step="Action Execution Skipped",
                    description="Decision is NO_ACTION. Backend modification skipped.",
                )
            )
            return None

        timeline.append(
            TimelineEvent(
                step="Submitting Action to Backend Safety Layer",
                description=(
                    f"Submitting {decision.proposed_action.action.value} request to backend safety layer "
                    f"(target instances: {decision.proposed_action.target_instances})."
                ),
                data=decision.proposed_action.to_dict(),
            )
        )

        result = self.action_adapter.submit_action(decision.proposed_action)

        timeline.append(
            TimelineEvent(
                step="Backend Execution Completed",
                description=f"Backend status: {result.status.value.upper()}. {result.message}",
                data=result.to_dict(),
            )
        )

        return result

    def verify_and_explain(
        self,
        service_id: str,
        objective: str,
        decision: AgentDecision,
        action_result: Optional[ActionResult],
        timeline: Optional[List[TimelineEvent]] = None,
    ) -> tuple[VerificationResult, Optional[ServiceState], str]:
        """
        Re-checks live state, verifies outcomes, and synthesizes explanation via LLM.
        """
        if timeline is None:
            timeline = []

        timeline.append(
            TimelineEvent(
                step="Post-Action State Re-Check",
                description=f"Re-fetching live state for '{service_id}' to independently verify actual cloud impact.",
            )
        )

        verification = self.verifier.verify(service_id, decision, action_result)

        timeline.append(
            TimelineEvent(
                step="Verification Completed",
                description=f"Verification status: {'SUCCESS' if verification.success else 'FAILED/DISCREPANCY'}. {verification.verification_notes}",
                data=verification.to_dict(),
            )
        )

        post_action_state = None
        try:
            post_action_state = self.investigation_adapter.get_service_state(service_id)
        except Exception:
            pass

        # Generate final explanation via LLM or deterministic fallback
        prompt = POST_ACTION_EXPLANATION_USER_TEMPLATE.format(
            service_id=service_id,
            objective=objective,
            decision=decision.decision.value,
            target_instances=decision.proposed_action.target_instances if decision.proposed_action else "N/A",
            reason=decision.reason,
            safety_considerations=", ".join(decision.safety_considerations) if decision.safety_considerations else "None",
            execution_status=action_result.status.value if action_result else "SKIPPED",
            execution_error=action_result.error if action_result and action_result.error else "None",
            live_instances=verification.actual_state.get("current_instances", "N/A"),
            is_verified=verification.is_verified,
            is_effective=verification.is_effective,
            verification_notes=verification.verification_notes,
        )

        try:
            llm_explanation = self.llm.generate(prompt, system_prompt=POST_ACTION_EXPLANATION_SYSTEM_PROMPT)
            explanation = llm_explanation
        except Exception as e:
            logger.warning(f"LLM explanation synthesis failed ({str(e)}). Using deterministic template.")
            explanation = self.verifier.generate_explanation(
                service_id=service_id,
                objective=objective,
                decision=decision,
                action_result=action_result,
                verification=verification,
            )

        timeline.append(
            TimelineEvent(
                step="Final Explanation Generated",
                description=f"Synthesized comprehensive audit summary and operational report. [Explanation -> {self.llm.provider_name}]",
                data={"llm_provider": self.llm.provider_name},
            )
        )

        return verification, post_action_state, explanation

    def run(
        self,
        service_id: str,
        objective: str = "Optimize cloud cost while preserving SLOs",
        initial_observation: Optional[Dict[str, Any]] = None,
    ) -> AgentExecutionResult:
        """
        Execute full autonomous agent workflow for a known service_id.
        """
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        timeline: List[TimelineEvent] = [
            TimelineEvent(
                step="Run Initialized",
                description=f"Starting optimization run {run_id} for service '{service_id}'. Objective: '{objective}'",
            )
        ]

        evidence = self.investigate(service_id, initial_observation=initial_observation, timeline=timeline)
        decision = self.decide(evidence, objective=objective, timeline=timeline)
        action_request = decision.proposed_action
        action_result = self.execute_action(decision, timeline=timeline)
        verification, post_state, explanation = self.verify_and_explain(
            service_id=service_id,
            objective=objective,
            decision=decision,
            action_result=action_result,
            timeline=timeline,
        )

        return AgentExecutionResult(
            run_id=run_id,
            service_id=service_id,
            objective=objective,
            evidence=evidence,
            decision=decision,
            action_request=action_request,
            action_result=action_result,
            post_action_state=post_state,
            verification=verification,
            final_explanation=explanation,
            timeline=timeline,
        )

    def run_request(
        self,
        user_request: str,
        default_service_id: str = "reports-worker",
        initial_observation: Optional[Dict[str, Any]] = None,
    ) -> AgentExecutionResult:
        """
        Full end-to-end entrypoint starting from raw natural-language user prompt.
        Uses LLM NLU to understand intent -> plans investigation -> reasons -> executes -> verifies -> explains.
        """
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        timeline: List[TimelineEvent] = [
            TimelineEvent(
                step="Run Initialized from Natural Language",
                description=f"Starting optimization run {run_id} from prompt: '{user_request}'.",
            )
        ]

        # 1. LLM NLU Understanding
        parsed = self.parse_natural_language_request(
            user_request,
            default_service_id=default_service_id,
            timeline=timeline,
        )
        service_id = parsed["service_id"]
        objective = parsed["objective"]
        tools = parsed["tools"]

        # 2. Investigation
        evidence = self.investigate(
            service_id=service_id,
            initial_observation=initial_observation,
            planned_tools=tools,
            timeline=timeline,
        )

        # 3. Decision
        decision = self.decide(evidence, objective=objective, timeline=timeline)

        # 4. Backend Execution
        action_request = decision.proposed_action
        action_result = self.execute_action(decision, timeline=timeline)

        # 5. Verification & Explanation
        verification, post_state, explanation = self.verify_and_explain(
            service_id=service_id,
            objective=objective,
            decision=decision,
            action_result=action_result,
            timeline=timeline,
        )

        return AgentExecutionResult(
            run_id=run_id,
            service_id=service_id,
            objective=objective,
            evidence=evidence,
            decision=decision,
            action_request=action_request,
            action_result=action_result,
            post_action_state=post_state,
            verification=verification,
            final_explanation=explanation,
            timeline=timeline,
        )
