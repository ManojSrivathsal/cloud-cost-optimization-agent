"""
agent/llm.py
Multi-provider LLM interface supporting Gemini, OpenAI, and a rich local mock provider.
Provides structured JSON generation, automatic .env loading, and safe configuration diagnostics.
"""

from __future__ import annotations
import os
import json
import re
import urllib.request
import urllib.error
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List


# Debug info container (safe: stores NO values or keys)
_ENV_DEBUG: Dict[str, Any] = {
    "found_path": None,
    "file_bytes": 0,
    "lines_count": 0,
    "parsed_keys": [],
    "key_length": 0,
    "error": None,
}


def load_dotenv(filepath: Optional[str] = None):
    """
    Lightweight, zero-dependency .env loader.
    Safely reads key=value pairs into os.environ.
    Handles UTF-8, UTF-8 with BOM, UTF-16, Windows CRLF, and quotes.
    """
    global _ENV_DEBUG
    candidate_paths = [
        filepath if filepath else None,
        os.path.join(os.getcwd(), ".env"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), ".env")),
        os.path.abspath(".env"),
    ]

    found_path = None
    for p in candidate_paths:
        if p and os.path.isfile(p):
            found_path = os.path.abspath(p)
            break

    _ENV_DEBUG["found_path"] = found_path
    if not found_path:
        _ENV_DEBUG["error"] = "No .env file found in candidate paths"
        return

    try:
        with open(found_path, "rb") as f:
            raw = f.read()
        _ENV_DEBUG["file_bytes"] = len(raw)
    except Exception as e:
        _ENV_DEBUG["error"] = f"Failed to read {found_path}: {str(e)}"
        return

    if not raw:
        _ENV_DEBUG["error"] = "File is empty (0 bytes)"
        return

    # Infallible binary encoding detection
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        content = raw.decode("utf-16", errors="ignore")
    elif raw.startswith(b"\xef\xbb\xbf"):
        content = raw[3:].decode("utf-8", errors="ignore")
    else:
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            content = raw.decode("latin-1", errors="ignore")

    lines = content.splitlines()
    _ENV_DEBUG["lines_count"] = len(lines)
    parsed_keys = []

    prev_key = None
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()

        separator = "=" if "=" in line else (":" if ":" in line and not line.startswith("http") else None)
        if separator:
            k, v = line.split(separator, 1)
            k = k.strip()
            v = v.strip().strip("'\"")
            if k:
                if v:
                    os.environ[k] = v
                    parsed_keys.append(k)
                    if k.upper() == "GEMINI_API_KEY":
                        os.environ["GEMINI_API_KEY"] = v
                    elif k.upper() == "OPENAI_API_KEY":
                        os.environ["OPENAI_API_KEY"] = v
                    prev_key = None
                else:
                    prev_key = k
        elif prev_key:
            v = line.strip().strip("'\"")
            if v:
                os.environ[prev_key] = v
                parsed_keys.append(prev_key)
                if prev_key.upper() == "GEMINI_API_KEY":
                    os.environ["GEMINI_API_KEY"] = v
                elif prev_key.upper() == "OPENAI_API_KEY":
                    os.environ["OPENAI_API_KEY"] = v
            prev_key = None

    _ENV_DEBUG["parsed_keys"] = parsed_keys
    gem_val = os.environ.get("GEMINI_API_KEY", "")
    _ENV_DEBUG["key_length"] = len(gem_val)


# Automatically load .env if present
load_dotenv()


class LLMInterface(ABC):
    """Abstract interface for LLM calls."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Returns the human-readable provider name."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Returns the active model name."""
        pass

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate free-form response text from the LLM."""
        pass

    @abstractmethod
    def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate structured JSON response from the LLM."""
        pass


def extract_json_from_text(text: str) -> Dict[str, Any]:
    """Helper to extract JSON object from LLM response text (handles markdown code fences)."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    return json.loads(text)


class GeminiLLM(LLMInterface):
    """
    Google Gemini API provider using direct HTTP REST.
    No external pip packages required.
    """

    def __init__(self, api_key: str, model: Optional[str] = None):
        self.api_key = api_key
        raw_model = model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.model = raw_model[7:] if raw_model.startswith("models/") else raw_model

    @property
    def provider_name(self) -> str:
        return "Gemini"

    @property
    def model_name(self) -> str:
        return self.model

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}]
        }
        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8")
            except Exception:
                pass
            raise RuntimeError(f"Gemini API HTTPError {e.code}: {e.reason}. Details: {err_body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Gemini API URLError: {e.reason}") from e

    def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return extract_json_from_text(text)
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8")
            except Exception:
                pass
            raise RuntimeError(f"Gemini API HTTPError {e.code}: {e.reason}. Details: {err_body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Gemini API URLError: {e.reason}") from e


class OpenAILLM(LLMInterface):
    """
    OpenAI-compatible API provider using direct HTTP REST.
    """

    def __init__(self, api_key: str, model: Optional[str] = None, base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.base_url = base_url.rstrip("/")

    @property
    def provider_name(self) -> str:
        return "OpenAI"

    @property
    def model_name(self) -> str:
        return self.model

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        url = f"{self.base_url}/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]

    def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        json_sys_prompt = (system_prompt or "") + "\nRespond with a valid JSON object only."
        raw_resp = self.generate(prompt, json_sys_prompt)
        return extract_json_from_text(raw_resp)


class LocalSimulatedLLM(LLMInterface):
    """
    Intelligent simulated LLM provider used for local testing, offline demos, and deterministic verification.
    Provides realistic reasoning, NLU parsing, and JSON decision generation without network dependencies.
    """

    @property
    def provider_name(self) -> str:
        return "LocalSimulatedLLM"

    @property
    def model_name(self) -> str:
        return "simulated-local-model"

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if "reports-worker" in prompt:
            return (
                "After analyzing telemetry for reports-worker, the service exhibits minimal CPU utilization (<10%) "
                "and negligible traffic (~1 RPS). The current provisioning of 4 instances is wasteful. "
                "I recommend scaling down to 1 instance, saving approximately $216/month while adhering "
                "to minimum capacity constraints and maintaining healthy latency headroom."
            )
        elif "checkout-api" in prompt:
            return (
                "Checkout-api telemetry reveals heavy incoming request load (>850 RPS) with p95 latency at 235ms, "
                "dangerously close to the 250ms SLA ceiling. CPU utilization is also elevated at 84%. "
                "Scaling down for cost optimization is strictly contraindicated. I recommend scaling up to 5 instances "
                "to protect checkout throughput and user experience."
            )
        elif "analytics-stream" in prompt:
            return (
                "The optimization was attempted, but backend infrastructure execution failed due to an provisioning timeout. "
                "The service remains safe at 5 instances. No partial state changes occurred. The operations team has been notified."
            )
        elif "order-processor" in prompt:
            return (
                "Telemetry re-check reveals active traffic and 68% CPU load on order-processor. "
                "The initial observation was stale. No scale-down action should be taken."
            )
        return "Autonomous evaluation completed: Service parameters analyzed against safety boundaries."

    def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        if "Understand the user's intent" in prompt or "Parse the optimization request" in prompt:
            service_id = "reports-worker"
            if "checkout" in prompt.lower():
                service_id = "checkout-api"
            elif "order" in prompt.lower():
                service_id = "order-processor"
            elif "analytics" in prompt.lower():
                service_id = "analytics-stream"
            elif "auth" in prompt.lower():
                service_id = "auth-service"

            return {
                "service_id": service_id,
                "objective": "Optimize cloud costs while respecting SLOs and safety constraints",
                "required_investigation_tools": [
                    "get_service_state",
                    "get_service_metrics",
                    "get_service_traffic",
                    "get_service_health",
                    "get_service_constraints",
                    "get_service_cost",
                ],
            }

        if "reports-worker" in prompt:
            return {
                "decision": "scale_down",
                "target_instances": 1,
                "confidence": 0.96,
                "reason": "Service reports-worker is severely underutilized (CPU: 8.5%, traffic: 1.2 RPS). Scaling from 4 to 1 instance saves $0.30/hr (~$216/month) with zero risk to latency.",
                "evidence_summary": [
                    "Current instances: 4, target: 1",
                    "CPU utilization: 8.5%",
                    "Traffic: 1.2 RPS",
                    "p95 Latency: 42ms (Limit: 200ms)",
                    "Health: healthy",
                ],
                "expected_effect": "Reduce compute cost by 75% while safely preserving minimum instance boundary.",
                "safety_considerations": [
                    "Target 1 instance matches min_instances constraint.",
                    "p95 latency (42ms) is well within 200ms SLO limit.",
                ],
            }

        if "checkout-api" in prompt:
            return {
                "decision": "scale_up",
                "target_instances": 5,
                "confidence": 0.94,
                "reason": "High traffic volume (860 RPS) and CPU load (84%) are pushing p95 latency to 235ms, nearing the 250ms SLA limit. Increasing capacity to 5 instances to prevent SLO breach.",
                "evidence_summary": [
                    "Current instances: 3, target: 5",
                    "CPU utilization: 84.0%",
                    "Traffic: 860 RPS",
                    "p95 Latency: 235ms (Limit: 250ms)",
                    "Health: healthy",
                ],
                "expected_effect": "Relieve CPU pressure and reduce p95 latency below 150ms.",
                "safety_considerations": [
                    "Target 5 instances is within max_instances limit of 10.",
                    "Preserves checkout revenue and user satisfaction.",
                ],
            }

        if "order-processor" in prompt:
            return {
                "decision": "no_action",
                "target_instances": None,
                "confidence": 0.92,
                "reason": "Live re-investigation shows order-processor is actively handling 350 RPS with 68% CPU. Stale observation ignored. Scaling down would degrade throughput.",
                "evidence_summary": [
                    "Live CPU: 68.0%",
                    "Live Traffic: 350 RPS",
                    "Health: healthy",
                ],
                "expected_effect": "Maintain current capacity for active processing.",
                "safety_considerations": ["Stale data discarded in favor of verified live state."],
            }

        if "analytics-stream" in prompt:
            return {
                "decision": "scale_down",
                "target_instances": 2,
                "confidence": 0.90,
                "reason": "Analytics stream utilization is low (11% CPU). Proposing scale down to 2 instances.",
                "evidence_summary": [
                    "Current instances: 5, target: 2",
                    "CPU: 11.0%",
                    "Traffic: 5.0 RPS",
                ],
                "expected_effect": "Reduce monthly cost from $1.50/hr to $0.60/hr.",
                "safety_considerations": ["Target 2 instances satisfies minimum boundary of 1."],
            }

        return {
            "decision": "no_action",
            "target_instances": None,
            "confidence": 0.85,
            "reason": "Service is operating within balanced parameters. No optimization needed.",
            "evidence_summary": ["Operational telemetry within normal boundaries."],
            "expected_effect": "Preserve stable configuration.",
            "safety_considerations": ["No state modification."],
        }


def get_llm_provider() -> LLMInterface:
    """
    Factory creating the appropriate LLM provider based on environment variables.
    Checks for GEMINI_API_KEY, then OPENAI_API_KEY, and defaults to LocalSimulatedLLM.
    """
    load_dotenv()
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key.strip():
        return GeminiLLM(api_key=gemini_key.strip())

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and openai_key.strip():
        return OpenAILLM(api_key=openai_key.strip())

    return LocalSimulatedLLM()


def get_llm_diagnostics() -> Dict[str, str]:
    """
    Returns non-secret diagnostic info about the active LLM provider and configuration.
    CRITICAL: NEVER returns or logs the actual API key.
    """
    load_dotenv()
    provider = get_llm_provider()

    if isinstance(provider, GeminiLLM):
        return {
            "provider": "Gemini",
            "model": provider.model,
            "api_key_configured": "YES",
            "is_real_llm": "YES",
        }
    elif isinstance(provider, OpenAILLM):
        return {
            "provider": "OpenAI",
            "model": provider.model,
            "api_key_configured": "YES",
            "is_real_llm": "YES",
        }
    else:
        return {
            "provider": "LocalSimulatedLLM",
            "model": "simulated-local-model",
            "api_key_configured": "NO",
            "is_real_llm": "NO",
        }
