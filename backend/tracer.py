"""
tracer.py — Langfuse initialisation and tracing helpers.

Every LLM generation is logged via `trace_llm_call`.
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
    secret_key = os.getenv("LANGFUSE_SECRET_KEY", "")
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

def trace_llm_call(
    prompt: str,
    output: Any,
    latency_ms: float,
    *,
    model: str = "llama-3.3-70b-versatile",
    name: str = "website-generator",
    metadata: dict | None = None,
) -> None:
    """
    Log a single LLM generation to Langfuse.

    Parameters
    ----------
    prompt      : The user-facing prompt sent to the agent.
    output      : Raw string output returned by the LLM.
    latency_ms  : Wall-clock time for the generation in milliseconds.
    model       : Model identifier (informational).
    name        : Trace name shown in the Langfuse UI.
    metadata    : Any extra key-value pairs to attach.
    """
    client = _get_client()
    if client is None:
        return  # tracing disabled — silent no-op

    try:
        trace = client.trace(name=name, metadata=metadata or {})
        trace.generation(
            name=name,
            model=model,
            input=prompt,
            output=str(output),
            usage={
                "unit": "MILLISECONDS",
                "total": latency_ms,
            },
        )
        client.flush()
        logger.debug("Langfuse trace flushed (latency=%.1f ms)", latency_ms)
    except Exception as exc:  # pragma: no cover
        # Never let tracing failures break the main request path
        logger.warning("Langfuse trace failed (non-fatal): %s", exc)
