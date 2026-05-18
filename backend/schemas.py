"""schemas.py — Pydantic models for the patch-based architecture."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class SectionPatch(BaseModel):
    section: str          # e.g. "navbar", "hero", "features", "cta", "footer"
    html: str
    css: str
    js: str | None = None


class WebsiteOutput(BaseModel):
    """Full generation response (first render)."""
    title: str
    sections: list[SectionPatch]
    # Optional: assembled from sections if the LLM omits them (graceful fallback)
    full_html: str = ""
    full_css: str = ""
    full_js: str = ""
    generation_time_ms: float = 0.0
    token_count: int = 0
    # Debug-only field: populated when ?debug=true is in the request
    debug_system_prompt: str | None = None


class RefinementOutput(BaseModel):
    """Surgical patch — only changed sections returned."""
    title: str
    changed_sections: list[SectionPatch]
    unchanged_section_names: list[str]
    generation_time_ms: float = 0.0
    token_count: int = 0
    fallback: bool = False   # True when refine failed and full regen was used
    # Debug-only field: populated when ?debug=true is in the request
    debug_system_prompt: str | None = None


class StylePreferences(BaseModel):
    palette: str = Field("minimal")
    font: str    = Field("Inter")
    layout: str  = Field("hero")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    style_preferences: Optional[StylePreferences] = None


class RefineRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    title: str
    current_sections: list[SectionPatch]
    style_preferences: Optional[StylePreferences] = None


class HealthResponse(BaseModel):
    status: str = "ok"


class ErrorResponse(BaseModel):
    detail: str
    raw_output: str | None = None
