"""
agent.py — Agno agent that wraps Groq and returns a validated WebsiteOutput.

Design decisions
----------------
* The system prompt demands ONLY raw JSON — no markdown fences, no prose.
* We parse the raw LLM text with json.loads and let Pydantic do field-level
  validation, so callers receive a well-typed WebsiteOutput or a descriptive
  exception they can surface as HTTP 422.
* The agent is stateless (no memory / sessions) so every call is independent.
"""

import json
import logging
import os
import re

from agno.agent import Agent
from agno.models.groq import Groq

from schemas import WebsiteOutput

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_ID = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an expert web developer. When given a description of a website, you MUST respond with a single JSON object — nothing else.

The JSON object must have exactly these four keys:
  "title" : string  — the page <title> text
  "html"  : string  — complete HTML body content (no <style> or <script> tags)
  "css"   : string  — complete CSS stylesheet
  "js"    : string  — complete JavaScript (empty string "" if none needed)

Rules:
- Output ONLY the raw JSON object. No markdown, no code fences, no explanations.
- Every key must be present. Values must be non-empty strings (except "js" which may be "").
- The html field must be valid HTML markup suitable for placing inside a <body>.
- The css field must be valid CSS.
- Make the design modern, visually appealing, and responsive.
"""


# ── Agent factory (cached) ────────────────────────────────────────────────────
_agent: Agent | None = None


def _get_agent() -> Agent:
    """Return a cached Agno Agent instance backed by Groq."""
    global _agent
    if _agent is None:
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise EnvironmentError(
                "GROQ_API_KEY environment variable is not set. "
                "Copy .env.example to .env and fill in your key."
            )
        _agent = Agent(
            model=Groq(id=MODEL_ID, api_key=groq_api_key),
            system_message=SYSTEM_PROMPT,
            # No memory — every request is independent
            add_history_to_messages=False,
            markdown=False,          # discourage markdown wrapping
        )
        logger.info("Agno agent initialised with model=%s", MODEL_ID)
    return _agent


# ── Public API ────────────────────────────────────────────────────────────────

def _extract_json(raw: str) -> str:
    """
    Best-effort extraction of a JSON object from the LLM response.

    Handles cases where the model wraps output in markdown fences despite
    instructions not to (e.g. ```json ... ```).
    """
    # Strip markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence_match:
        return fence_match.group(1)

    # Try to find a bare JSON object
    brace_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if brace_match:
        return brace_match.group(0)

    return raw.strip()


def generate_website(prompt: str) -> tuple[WebsiteOutput, str]:
    """
    Run the Agno/Groq agent and return a validated WebsiteOutput.

    Returns
    -------
    (WebsiteOutput, raw_text)
        raw_text is the unprocessed LLM response (useful for tracing/debugging).

    Raises
    ------
    ValueError
        If the LLM output cannot be parsed as valid JSON or does not conform
        to the WebsiteOutput schema. The caller should surface this as HTTP 422.
    RuntimeError
        If the agent call itself fails (network error, quota exceeded, etc.).
    """
    agent = _get_agent()
    user_message = (
        f"Create a website for the following description:\n\n{prompt}\n\n"
        "Remember: output ONLY the raw JSON object, nothing else."
    )

    logger.debug("Sending prompt to Groq agent: %.120s…", user_message)

    try:
        response = agent.run(user_message)
    except Exception as exc:
        logger.exception("Groq agent call failed")
        raise RuntimeError(f"LLM call failed: {exc}") from exc

    # Agno wraps the response; extract the text content
    raw_text: str = ""
    if hasattr(response, "content"):
        raw_text = response.content or ""
    elif hasattr(response, "messages") and response.messages:
        raw_text = response.messages[-1].content or ""
    else:
        raw_text = str(response)

    logger.debug("Raw LLM response (first 300 chars): %.300s", raw_text)

    # ── Parse & validate ──────────────────────────────────────────────────────
    json_str = _extract_json(raw_text)

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as exc:
        logger.error("JSON decode error: %s | raw=%s", exc, raw_text[:500])
        raise ValueError(
            f"LLM returned malformed JSON: {exc}. "
            f"Raw output (first 500 chars): {raw_text[:500]}"
        ) from exc

    try:
        website = WebsiteOutput(**data)
    except Exception as exc:
        logger.error("WebsiteOutput validation error: %s | data=%s", exc, data)
        raise ValueError(
            f"LLM output does not match WebsiteOutput schema: {exc}"
        ) from exc

    logger.info("WebsiteOutput validated successfully (title=%r)", website.title)
    return website, raw_text
