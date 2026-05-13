"""
schemas.py — Pydantic models for structured LLM output validation.
"""

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    """Incoming request body for the /generate endpoint."""
    prompt: str = Field(..., min_length=1, description="User's website description prompt")


class WebsiteOutput(BaseModel):
    """
    Structured output returned by the Agno/Groq agent.
    Every field is mandatory; the LLM must produce all four.
    """
    title: str = Field(..., description="Page <title> text")
    html: str = Field(..., description="Full HTML markup (body content, no <style> or <script> tags)")
    css: str = Field(..., description="Complete CSS stylesheet")
    js: str = Field(..., description="Complete JavaScript (may be empty string if not needed)")


class HealthResponse(BaseModel):
    """Response body for the /health endpoint."""
    status: str = "ok"


class ErrorResponse(BaseModel):
    """Standardised error payload."""
    detail: str
    raw_output: str | None = None
