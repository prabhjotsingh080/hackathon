"""main.py — FastAPI app with /generate, /refine, /generate-vision, /health."""
import json as _json
import logging
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from agent import (
    generate_website, refine_website, generate_website_from_image,
    GENERATE_SYSTEM, REFINE_SYSTEM, TEXT_MODEL, VISION_MODEL, IMAGE_ENCODING,
)
from schemas import (
    GenerateRequest, RefineRequest, HealthResponse,
    WebsiteOutput, RefinementOutput,
)
from tracer import trace_llm_call

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Accepted image MIME types for /generate-vision
_ALLOWED_IMAGE_MIMES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp",
    "image/gif", "image/bmp", "image/svg+xml",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("GenAI Website Builder API starting up...")
    logger.info("Image encoding scheme: %s", IMAGE_ENCODING)
    yield
    logger.info("GenAI Website Builder API shutting down.")


app = FastAPI(
    title="GenAI Website Builder API",
    description="Patch-based website generation using Groq LLM.",
    version="2.2.0",
    lifespan=lifespan,
)

_allowed_origin = os.getenv("ALLOWED_ORIGIN", "").strip()
_cors_origins = (
    [_allowed_origin, "http://localhost:3000", "http://localhost:5173"]
    if _allowed_origin else ["*"]
)
logging.getLogger("main.cors").info("CORS allow_origins=%s", _cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=bool(_allowed_origin),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": f"Internal server error: {exc}"})


# ── /health ───────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Ops"])
async def health() -> HealthResponse:
    return HealthResponse()


# ── /generate ─────────────────────────────────────────────────────────────────
@app.post("/generate", response_model=WebsiteOutput, tags=["Generation"],
          responses={400: {"description": "Empty prompt"},
                     422: {"description": "LLM returned malformed JSON"},
                     503: {"description": "LLM unavailable"}})
async def generate(
    body: GenerateRequest,
    debug: bool = Query(False, description="Return full system prompt in response"),
) -> WebsiteOutput:
    if not body.prompt.strip():
        logger.warning("[GUARD] Empty prompt rejected")
        raise HTTPException(400, {"detail": "Prompt cannot be empty."})

    logger.info(
        "[PROMPT_IN /generate] prompt=%.200r | image_attached=no | style_prefs=%s",
        body.prompt,
        body.style_preferences.model_dump() if body.style_preferences else None,
    )
    t0 = time.monotonic()
    style = body.style_preferences.model_dump() if body.style_preferences else None

    try:
        site, raw, usage, system_prompt = generate_website(body.prompt, style)
    except ValueError as exc:
        ms = (time.monotonic() - t0) * 1000
        logger.error("[PARSE_FAIL /generate] %s", exc)
        trace_llm_call(body.prompt, str(exc), ms,
                       model=TEXT_MODEL, name="generate-error",
                       metadata={"error": True, "mode": "generate"})
        raise HTTPException(422, {"detail": str(exc)}) from exc
    except RuntimeError as exc:
        ms = (time.monotonic() - t0) * 1000
        trace_llm_call(body.prompt, str(exc), ms,
                       model=TEXT_MODEL, name="generate-error",
                       metadata={"error": True, "mode": "generate"})
        raise HTTPException(503, {"detail": str(exc)}) from exc

    ms = (time.monotonic() - t0) * 1000
    site.generation_time_ms = ms
    site.token_count = usage.get("total", 0)

    langfuse_meta = {
        "mode": "generate",
        "title": site.title,
        "sections_count": len(site.sections),
        "sections": [s.section for s in site.sections],
        "style_prefs": style,
        "tokens": usage,
    }
    trace_llm_call(
        body.prompt, raw, ms,
        model=TEXT_MODEL,
        name="generate",
        system_prompt=system_prompt,
        metadata=langfuse_meta,
        input_tokens=usage.get("input", 0),
        output_tokens=usage.get("output", 0),
        total_tokens=usage.get("total", 0),
    )
    logger.info("[LANGFUSE_SENT /generate] meta=%s", langfuse_meta)
    logger.info("generate done %.0f ms title=%r sections=%d tokens=%s",
                ms, site.title, len(site.sections), usage)

    if debug:
        site.debug_system_prompt = (
            system_prompt.compile() if hasattr(system_prompt, "compile") else str(system_prompt)
        )
    return site


# ── /refine ───────────────────────────────────────────────────────────────────
@app.post("/refine", response_model=RefinementOutput, tags=["Generation"],
          responses={400: {"description": "Empty prompt"},
                     503: {"description": "LLM unavailable"}})
async def refine(
    body: RefineRequest,
    debug: bool = Query(False),
) -> RefinementOutput:
    if not body.prompt.strip():
        logger.warning("[GUARD] Empty refine prompt rejected")
        raise HTTPException(400, {"detail": "Prompt cannot be empty."})

    logger.info(
        "[PROMPT_IN /refine] prompt=%.200r | sections=%s | style_prefs=%s",
        body.prompt,
        [s.section for s in body.current_sections],
        body.style_preferences.model_dump() if body.style_preferences else None,
    )
    t0 = time.monotonic()
    style = body.style_preferences.model_dump() if body.style_preferences else None

    try:
        result, raw, usage, system_prompt = refine_website(
            body.prompt, body.current_sections, body.title, style)
        ms = (time.monotonic() - t0) * 1000
        result.generation_time_ms = ms
        result.token_count = usage.get("total", 0)

        langfuse_meta = {
            "mode": "refine",
            "title": result.title,
            "changed": [s.section for s in result.changed_sections],
            "unchanged": result.unchanged_section_names,
            "style_prefs": style,
            "tokens": usage,
        }
        trace_llm_call(
            body.prompt, raw, ms,
            model=TEXT_MODEL,
            name="refine",
            system_prompt=system_prompt,
            metadata=langfuse_meta,
            input_tokens=usage.get("input", 0),
            output_tokens=usage.get("output", 0),
            total_tokens=usage.get("total", 0),
        )
        logger.info("[LANGFUSE_SENT /refine] meta=%s", langfuse_meta)
        logger.info("refine done %.0f ms changed=%s tokens=%s", ms,
                    [s.section for s in result.changed_sections], usage)

        if debug:
            result.debug_system_prompt = (
                system_prompt.compile() if hasattr(system_prompt, "compile") else str(system_prompt)
            )
        return result

    except ValueError as exc:
        logger.warning(
            "[FALLBACK /refine] Parse failed (%s) - falling back to full regen. reason: %s",
            type(exc).__name__, exc,
        )
        try:
            site, raw2, usage2, system_prompt2 = generate_website(body.prompt, style)
        except RuntimeError as exc2:
            ms = (time.monotonic() - t0) * 1000
            trace_llm_call(body.prompt, str(exc2), ms,
                           model=TEXT_MODEL, name="refine-fallback-error",
                           metadata={"error": True, "mode": "refine-fallback"})
            raise HTTPException(503, {"detail": str(exc2)}) from exc2

        ms = (time.monotonic() - t0) * 1000
        fallback = RefinementOutput(
            title=site.title,
            changed_sections=site.sections,
            unchanged_section_names=[],
            generation_time_ms=ms,
            token_count=usage2.get("total", 0),
            fallback=True,
        )
        langfuse_meta = {
            "mode": "refine-fallback",
            "fallback": True,
            "original_error": str(exc)[:200],
            "style_prefs": style,
            "tokens": usage2,
        }
        trace_llm_call(
            body.prompt, raw2, ms,
            model=TEXT_MODEL,
            name="refine-fallback",
            system_prompt=system_prompt2,
            metadata=langfuse_meta,
            input_tokens=usage2.get("input", 0),
            output_tokens=usage2.get("output", 0),
            total_tokens=usage2.get("total", 0),
        )
        logger.info("[LANGFUSE_SENT /refine-fallback] meta=%s", langfuse_meta)

        if debug:
            fallback.debug_system_prompt = (
                system_prompt2.compile() if hasattr(system_prompt2, "compile") else str(system_prompt2)
            )
        return fallback

    except RuntimeError as exc:
        ms = (time.monotonic() - t0) * 1000
        trace_llm_call(body.prompt, str(exc), ms,
                       model=TEXT_MODEL, name="refine-error",
                       metadata={"error": True, "mode": "refine"})
        raise HTTPException(503, {"detail": str(exc)}) from exc


# ── /generate-vision ──────────────────────────────────────────────────────────
@app.post("/generate-vision", response_model=WebsiteOutput, tags=["Generation"],
          responses={400: {"description": "Empty prompt"},
                     415: {"description": "Uploaded file is not a supported image"},
                     422: {"description": "LLM returned malformed JSON"},
                     503: {"description": "Vision LLM unavailable"}})
async def generate_vision(
    prompt:            str        = Form(...),
    image:             UploadFile = File(...),
    style_preferences: str        = Form(None),
    debug:             bool       = Query(False),
) -> WebsiteOutput:
    if not prompt.strip():
        logger.warning("[GUARD] Empty vision prompt rejected")
        raise HTTPException(400, {"detail": "Prompt cannot be empty."})

    # Allow through even if content_type is missing — agent will detect from bytes
    mime = (image.content_type or "").lower().strip()
    if mime and mime not in _ALLOWED_IMAGE_MIMES:
        logger.warning("[GUARD] Rejected non-image upload mime=%s filename=%s", mime, image.filename)
        raise HTTPException(
            415,
            {"detail": f"Unsupported file type '{mime}'. "
                       "Please upload a PNG, JPEG, WebP, or GIF image."},
        )

    logger.info(
        "[PROMPT_IN /generate-vision] declared_mime=%s prompt=%.200r | image_attached=yes | style_prefs=%s",
        mime or "unknown (will detect from bytes)", prompt, style_preferences,
    )
    t0 = time.monotonic()
    style = _json.loads(style_preferences) if style_preferences else None
    image_bytes = await image.read()
    logger.debug("[VISION_IMAGE] size=%d bytes declared_mime=%s filename=%s",
                 len(image_bytes), mime, image.filename)

    try:
        site, raw, usage, system_prompt = generate_website_from_image(
            prompt, image_bytes, mime, style)
    except ValueError as exc:
        ms = (time.monotonic() - t0) * 1000
        logger.error("[PARSE_FAIL /generate-vision] %s", exc)
        trace_llm_call(prompt, str(exc), ms,
                       model=VISION_MODEL, name="vision-error",
                       metadata={"error": True, "mode": "vision", "image_provided": True,
                                 "image_encoding": IMAGE_ENCODING})
        raise HTTPException(422, {"detail": str(exc)}) from exc
    except RuntimeError as exc:
        ms = (time.monotonic() - t0) * 1000
        trace_llm_call(prompt, str(exc), ms,
                       model=VISION_MODEL, name="vision-error",
                       metadata={"error": True, "mode": "vision", "image_provided": True,
                                 "image_encoding": IMAGE_ENCODING})
        raise HTTPException(503, {"detail": str(exc)}) from exc

    ms = (time.monotonic() - t0) * 1000
    site.generation_time_ms = ms
    site.token_count = usage.get("total", 0)

    langfuse_meta = {
        "mode": "vision",
        "image_provided": True,
        "image_encoding": IMAGE_ENCODING,
        "image_size_bytes": len(image_bytes),
        "image_filename": image.filename,
        "title": site.title,
        "sections": [s.section for s in site.sections],
        "style_prefs": style,
        "tokens": usage,
    }
    trace_llm_call(
        prompt, raw, ms,
        model=VISION_MODEL,
        name="vision",
        system_prompt=system_prompt,
        metadata=langfuse_meta,
        input_tokens=usage.get("input", 0),
        output_tokens=usage.get("output", 0),
        total_tokens=usage.get("total", 0),
    )
    logger.info("[LANGFUSE_SENT /generate-vision] meta=%s", langfuse_meta)
    logger.info("vision done %.0f ms title=%r sections=%d tokens=%s",
                ms, site.title, len(site.sections), usage)

    if debug:
        site.debug_system_prompt = (
            system_prompt.compile() if hasattr(system_prompt, "compile") else str(system_prompt)
        )
    return site


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
