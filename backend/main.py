"""
main.py — FastAPI application entry point.

Endpoints
---------
POST /generate  Accept { "prompt": str }, call the Agno/Groq agent,
                trace with Langfuse, return WebsiteOutput JSON.
GET  /health    Returns { "status": "ok" } — used by load-balancers / CI.
"""

import logging
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load .env before any other local imports that read env vars
load_dotenv()

from agent import generate_website          # noqa: E402  (after load_dotenv)
from schemas import GenerateRequest, HealthResponse, WebsiteOutput  # noqa: E402
from tracer import trace_llm_call           # noqa: E402

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown hooks) ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("GenAI Website Builder API starting up…")
    yield
    logger.info("GenAI Website Builder API shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GenAI Website Builder API",
    description="Generate full HTML/CSS/JS websites from a text prompt using Groq LLM.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# In production set ALLOWED_ORIGIN to your Vercel URL, e.g.:
#   https://genai-website-builder.vercel.app
# When unset (local dev) we allow all origins so any localhost port works.
_allowed_origin = os.getenv("ALLOWED_ORIGIN", "").strip()
_cors_origins: list[str] = (
    [_allowed_origin, "http://localhost:3000", "http://localhost:5173"]
    if _allowed_origin
    else ["*"]
)
logger_pre = logging.getLogger("main.cors")
logger_pre.info("CORS allow_origins=%s", _cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=bool(_allowed_origin),   # credentials only with explicit origin
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler — catches unhandled 500s ────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc}"},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["Ops"],
)
async def health() -> HealthResponse:
    """Returns `{ "status": "ok" }` — used by load-balancers and CI pipelines."""
    return HealthResponse()


@app.post(
    "/generate",
    response_model=WebsiteOutput,
    summary="Generate a website from a text prompt",
    tags=["Generation"],
    responses={
        422: {
            "description": "LLM returned malformed or non-conforming JSON",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "LLM returned malformed JSON: …",
                        "raw_output": "… raw LLM text …",
                    }
                }
            },
        },
        503: {"description": "LLM service unavailable"},
    },
)
async def generate(body: GenerateRequest) -> WebsiteOutput:
    """
    Accept a natural-language website description and return a structured
    `WebsiteOutput` containing `title`, `html`, `css`, and `js` fields.

    **Error handling**
    - `422` — LLM output could not be parsed / validated.
    - `503` — Groq API call failed (network / quota).
    """
    logger.info("POST /generate — prompt=%.80r", body.prompt)
    t0 = time.monotonic()

    try:
        website, raw_text = generate_website(body.prompt)
    except ValueError as exc:
        # Malformed / non-conforming JSON from the LLM
        latency_ms = (time.monotonic() - t0) * 1000
        trace_llm_call(
            prompt=body.prompt,
            output=str(exc),
            latency_ms=latency_ms,
            metadata={"error": True, "error_type": "parse_error"},
        )
        raise HTTPException(
            status_code=422,
            detail={
                "detail": str(exc),
                "raw_output": str(exc)[-500:],   # truncate for safety
            },
        ) from exc
    except RuntimeError as exc:
        # LLM service-level failure (network, quota, etc.)
        latency_ms = (time.monotonic() - t0) * 1000
        trace_llm_call(
            prompt=body.prompt,
            output=str(exc),
            latency_ms=latency_ms,
            metadata={"error": True, "error_type": "runtime_error"},
        )
        raise HTTPException(
            status_code=503,
            detail={"detail": str(exc)},
        ) from exc

    latency_ms = (time.monotonic() - t0) * 1000
    logger.info(
        "Generation completed in %.0f ms — title=%r", latency_ms, website.title
    )

    # ── Trace successful call ─────────────────────────────────────────────────
    trace_llm_call(
        prompt=body.prompt,
        output=raw_text,
        latency_ms=latency_ms,
        metadata={"title": website.title, "success": True},
    )

    return website


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
