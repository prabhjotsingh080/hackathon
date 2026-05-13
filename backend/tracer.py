"""
tracer.py — Langfuse initialisation and tracing helpers.

Every LLM generation is logged via `trace_llm_call` with proper
generation spans: model, input prompt, system prompt, output, token
usage, latency, and arbitrary metadata.

Langfuse is initialised lazily (once) and is fully optional:
if the keys are missing the helper is a no-op so the server
still starts in dev environments without Langfuse credentials.
"""

import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Lazy singleton ────────────────────────────────────────────────────────────
_langfuse_client = None


def _get_client():
    """Return a cached Langfuse client, or None if credentials are absent."""
    global _langfuse_client
    if _langfuse_client is not None:
        return _langfuse_client

    public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    secret_key  = os.getenv("LANGFUSE_SECRET_KEY", "")
    # Accept LANGFUSE_BASE_URL (used in .env) or LANGFUSE_HOST as fallback
    host = (
        os.getenv("LANGFUSE_BASE_URL")
        or os.getenv("LANGFUSE_HOST")
        or "https://cloud.langfuse.com"
    )

    if not public_key or not secret_key:
        logger.warning(
            "Langfuse credentials not found — tracing is disabled. "
            "Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable it."
        )
        return None

    try:
        from langfuse import Langfuse  # imported here to avoid hard-crash at startup

        _langfuse_client = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
        )
        logger.info("Langfuse client initialised (host=%s)", host)
    except Exception as exc:  # pragma: no cover
        logger.error("Failed to initialise Langfuse: %s", exc)

    return _langfuse_client


# ── Public API ────────────────────────────────────────────────────────────────

def get_langfuse_prompt(name: str, fallback: str) -> Any:
    """
    Fetch a prompt from Langfuse Prompt Management.
    Falls back to the provided string if Langfuse is disabled or prompt is missing.
    """
    client = _get_client()
    if client is None:
        return fallback

    try:
        # Fetch prompt from Langfuse (cached by the SDK)
        prompt = client.get_prompt(name)
        logger.info("Fetched prompt '%s' from Langfuse (v%d)", name, prompt.version)
        return prompt
    except Exception as exc:
        logger.warning("Failed to fetch prompt '%s' from Langfuse: %s. Using fallback.", name, exc)
        return fallback


def trace_llm_call(
    prompt: str,
    output: Any,
    latency_ms: float,
    *,
    model: str = "llama-3.3-70b-versatile",
    name: str = "website-generator",
    system_prompt: str | None = None,
    metadata: dict | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
) -> None:
    """
    Log a single LLM generation to Langfuse with full span details.

    Parameters
    ----------
    prompt        : The user-facing prompt sent to the agent.
    output        : Raw string output returned by the LLM.
    latency_ms    : Wall-clock time for the generation in milliseconds.
    model         : Model identifier (shown in Langfuse).
    name          : Trace/generation name shown in the Langfuse UI.
    system_prompt : The system prompt used for this call (optional).
    metadata      : Any extra key-value pairs to attach to the trace.
    input_tokens  : Prompt token count (if available).
    output_tokens : Completion token count (if available).
    total_tokens  : Total token count (if available).
    """
    client = _get_client()
    if client is None:
        return  # tracing disabled — silent no-op

    mode = (metadata or {}).get("mode", name)
    trace_name = f"genai-website-builder/{mode}"

    try:
        trace = client.trace(
            name=trace_name,
            input=prompt,
            output=str(output)[:2000],   # cap to avoid huge payloads
            metadata={
                **(metadata or {}),
                "latency_ms": round(latency_ms, 1),
            },
        )

        # Build token usage dict
        usage = {"unit": "TOKENS"}
        if total_tokens:
            usage["total"] = total_tokens
        if input_tokens:
            usage["input"] = input_tokens
        if output_tokens:
            usage["output"] = output_tokens
        # Fallback: use latency as a rough proxy if no token counts
        if not total_tokens and not input_tokens:
            usage = {"unit": "MILLISECONDS", "total": latency_ms}

        generation_input = prompt
        if system_prompt:
            generation_input = {
                "system": system_prompt,
                "user": prompt,
            }

        # If system_prompt is a Langfuse Prompt object, link it
        langfuse_prompt = None
        if not isinstance(system_prompt, str) and hasattr(system_prompt, "name"):
            langfuse_prompt = system_prompt
            system_prompt_str = system_prompt.compile()
            generation_input["system"] = system_prompt_str
        else:
            system_prompt_str = system_prompt

        trace.generation(
            name=f"{mode}-generation",
            model=model,
            prompt=langfuse_prompt,
            model_parameters={
                "max_tokens": (metadata or {}).get("max_tokens", "N/A"),
            },
            input=generation_input,
            output=str(output)[:4000],
            usage=usage,
            metadata={
                **(metadata or {}),
                "latency_ms": round(latency_ms, 1),
            },
        )

        client.flush()
        logger.debug(
            "Langfuse trace flushed: trace=%s model=%s tokens=%s latency=%.1f ms",
            trace_name, model, total_tokens or "N/A", latency_ms,
        )
    except Exception as exc:  # pragma: no cover
        # Never let tracing failures break the main request path
        logger.warning("Langfuse trace failed (non-fatal): %s", exc)
