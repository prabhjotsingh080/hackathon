"""
agent.py — Pure Groq client for all LLM calls.
Three public functions returning (output, raw_text, token_count):
  generate_website(prompt, style_preferences) -> WebsiteOutput
  refine_website(prompt, current_sections, title, style_preferences) -> RefinementOutput
  generate_website_from_image(prompt, image_bytes, mime, style_preferences) -> WebsiteOutput

Image encoding: standard base64 (RFC 4648) encoded as UTF-8 string,
embedded in a data-URI: data:<mime>;base64,<b64string>
"""
import base64
import json
import logging
import os
import re
from typing import Any

from groq import Groq as GroqClient

from schemas import SectionPatch, WebsiteOutput, RefinementOutput
from rag import retrieve_design_context
from tracer import get_langfuse_prompt

logging.basicConfig(level=logging.DEBUG,
                    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
logger = logging.getLogger(__name__)

TEXT_MODEL   = "llama-3.3-70b-versatile"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# IMAGE_ENCODING tells callers / Langfuse which encoding scheme is used
IMAGE_ENCODING = "base64/RFC-4648 (UTF-8 decoded data-URI)"

SECTION_ORDER = ["navbar", "hero", "features", "about", "pricing",
                 "testimonials", "cta", "footer"]

# ── System prompts ─────────────────────────────────────────────────────────────
GENERATE_SYSTEM = """You are an expert UI designer and frontend developer. Return a SINGLE raw JSON object - no markdown, no explanation:

{"title":"<page title>","sections":[{"section":"navbar","html":"...","css":"...","js":null},{"section":"hero","html":"...","css":"...","js":null},{"section":"features","html":"...","css":"...","js":null},{"section":"cta","html":"...","css":"...","js":null},{"section":"footer","html":"...","css":"...","js":null}],"full_html":"<all html joined>","full_css":"<all css joined, start with *, *::before, *::after { box-sizing: border-box; } body { margin: 0; }>","full_js":""}

MANDATORY STYLING RULES - violating ANY = wrong output:
1. Hero: gradient or dark background (#0f0c29 or similar), white text, font-size clamp(2.5rem,5vw,4.5rem), CTA button with :hover (transform+box-shadow). NEVER white hero.
2. Every section: explicit background-color, padding 80px top/bottom minimum, distinct from adjacent sections.
3. Buttons: background-color, border-radius 8px+, padding 12px 28px+, font-weight:700, :hover with transform+color change. Never bare <button>.
4. Navbar: dark/semi-transparent background, logo left, flex nav links right, padding 16px 48px.
5. Typography: Google Font @import in first section css only, h1 3rem+, h2 2rem+, body 1rem, line-height 1.7.
6. NO white plain-text sections anywhere. Every section needs distinct background.
7. REAL content only - real headings, subheadings, body copy, button labels. No lorem ipsum.
8. CSS scoped: every class prefixed with section name (.hero-title, .navbar-link, .features-card). No generic .title or .card.
9. Each section root element must have id="{section}" (e.g. <nav id="navbar">, <section id="hero">).
10. Vague prompt? Default to modern SaaS landing page: navbar+hero+features+pricing+cta+footer.
Output ONLY the raw JSON."""

REFINE_SYSTEM = """You are surgically editing sections of an existing website. Return a SINGLE raw JSON - no markdown:

{"title":"<same or updated>","changed_sections":[{"section":"hero","html":"...","css":"...","js":null}],"unchanged_section_names":["navbar","features","footer"]}

MANDATORY STYLING for changed sections: gradient/dark backgrounds, scoped CSS classes, styled buttons with :hover, explicit padding 80px+. Keep id="{section}" on root element.

IMPORTANT: Only return sections that need to change. Return ALL other section names in unchanged_section_names.
Output ONLY the raw JSON."""


# ── Helpers ───────────────────────────────────────────────────────────────────
def _client() -> GroqClient:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise EnvironmentError("GROQ_API_KEY not set.")
    return GroqClient(api_key=key)


def _extract_json(raw: str) -> str:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence:
        return fence.group(1)
    brace = re.search(r"\{.*\}", raw, re.DOTALL)
    return brace.group(0) if brace else raw.strip()


def _style_note(style: dict | None) -> str:
    if not style:
        return ""
    font = style.get("font", "Inter")
    font_url = font.replace(" ", "+")
    palette_notes = {
        "minimal":     "Clean light backgrounds (#f8fafc), dark text (#0f172a), subtle borders.",
        "dark":        "Very dark bg (#0f172a, #1e293b), indigo/purple accents (#6366f1), white text.",
        "vibrant":     "Bold orange (#f97316), pink (#ec4899), purple (#8b5cf6) gradients.",
        "earthy":      "Warm browns (#78350f), ambers (#d97706), cream (#fde68a) tones.",
        "corporate":   "Deep blue (#1d4ed8) primary, professional white surfaces, clean typography.",
        "ocean":       "Deep teal (#0d9488), cyan (#06b6d4), dark navy (#0f172a) backgrounds.",
        "sunset":      "Warm coral (#f43f5e), orange (#fb923c), golden (#f59e0b) gradients.",
        "forest":      "Deep green (#14532d), emerald (#10b981), natural cream (#fefce8) tones.",
        "midnight":    "Pure black (#000000), electric blue (#3b82f6), cyan neon (#22d3ee) accents.",
        "rose":        "Soft rose (#fda4af), deep crimson (#be123c), blush (#fff1f2) backgrounds.",
    }
    layout_notes = {
        "hero":        "Full-width hero section at top, then stacked feature sections below.",
        "grid":        "Card grid layout with 3+ columns of feature cards as primary content.",
        "sidebar":     "Left sidebar navigation with main content area on the right.",
        "magazine":    "Editorial magazine layout with varied card sizes and masonry-style grid.",
        "single":      "Single column layout, centered content, max-width 720px.",
        "bento":       "Bento box grid: asymmetric card sizes (1×1, 2×1, 1×2) like Apple's style.",
        "split":       "50/50 split sections alternating text left/image right and vice versa.",
        "fullscreen":  "Each section occupies 100vh, scroll-snap enabled, immersive full-screen.",
    }
    layout = style.get("layout", "hero")
    palette = style.get("palette", "minimal")
    return (
        f"\n\nSTYLE REQUIREMENTS (must follow exactly):\n"
        f"- Color Palette: {palette} — {palette_notes.get(palette, 'Use the specified palette.')}\n"
        f"- Font: {font} — use @import url('https://fonts.googleapis.com/css2?family="
        f"{font_url}:wght@300;400;600;700;800&display=swap'); apply font-family to body and all headings.\n"
        f"- Layout: {layout} — {layout_notes.get(layout, 'Use the specified layout pattern.')}"
    )


def _rag_note(prompt: str, style_prefs: dict | None = None) -> str:
    snippets = retrieve_design_context(prompt, style_prefs)
    if not snippets:
        return ""
    return "\n\nDesign inspiration (adapt these CSS patterns):\n" + "\n\n".join(snippets)


def _sort_sections(sections: list[SectionPatch]) -> list[SectionPatch]:
    def _rank(s: SectionPatch) -> int:
        try:
            return SECTION_ORDER.index(s.section.lower())
        except ValueError:
            return 65
    before = [s.section for s in sections]
    sorted_secs = sorted(sections, key=_rank)
    after = [s.section for s in sorted_secs]
    if before != after:
        logger.info("[SECTION_ORDER_BEFORE] %s", before)
        logger.info("[SECTION_ORDER_AFTER]  %s", after)
    return sorted_secs


def _parse_website(raw: str, context: str = "") -> WebsiteOutput:
    logger.debug("[PARSE_ATTEMPT %s] len=%d %.300s", context, len(raw), raw)
    extracted = _extract_json(raw)
    try:
        data = json.loads(extracted)
    except json.JSONDecodeError as e:
        logger.error("[PARSE_FAIL] JSONDecodeError: %s | raw: %.400s", e, raw)
        raise ValueError(f"Malformed JSON from LLM: {e}. Raw: {raw[:400]}") from e
    try:
        site = WebsiteOutput(**data)
        site.sections = _sort_sections(site.sections)
        logger.info("[PARSE_SUCCESS] title=%r sections=%s html_chars=%s css_chars=%s",
                    site.title, [s.section for s in site.sections],
                    {s.section: len(s.html) for s in site.sections},
                    {s.section: len(s.css) for s in site.sections})
        return site
    except Exception as e:
        logger.error("[PARSE_FAIL] Pydantic: %s | keys=%s", e, list(data.keys()))
        raise ValueError(f"WebsiteOutput schema mismatch: {e}") from e


def _parse_refinement(raw: str) -> RefinementOutput:
    logger.debug("[PARSE_ATTEMPT refine] len=%d %.300s", len(raw), raw)
    extracted = _extract_json(raw)
    try:
        data = json.loads(extracted)
    except json.JSONDecodeError as e:
        logger.error("[PARSE_FAIL refine] JSONDecodeError: %s | raw: %.400s", e, raw)
        raise ValueError(f"Malformed refinement JSON: {e}. Raw: {raw[:400]}") from e
    try:
        result = RefinementOutput(**data)
        logger.info("[PARSE_SUCCESS refine] title=%r changed=%s unchanged=%s",
                    result.title, [s.section for s in result.changed_sections],
                    result.unchanged_section_names)
        return result
    except Exception as e:
        logger.error("[PARSE_FAIL refine] Pydantic: %s | keys=%s", e, list(data.keys()))
        raise ValueError(f"RefinementOutput schema mismatch: {e}") from e


def _call_with_retry(messages, model, max_tokens, parse_fn, context=""):
    """Call Groq and retry once with correction nudge if parse fails.
    Returns (parsed, raw, usage_dict) where usage_dict has total/input/output tokens.
    """
    c = _client()
    for attempt in (1, 2):
        try:
            resp = c.chat.completions.create(model=model, messages=messages,
                                              max_tokens=max_tokens)
        except Exception as e:
            raise RuntimeError(f"Groq call failed: {e}") from e

        raw    = resp.choices[0].message.content or ""
        usage  = resp.usage
        tokens = usage.total_tokens if usage else 0
        usage_dict = {
            "total":  usage.total_tokens     if usage else 0,
            "input":  usage.prompt_tokens    if usage else 0,
            "output": usage.completion_tokens if usage else 0,
        }
        logger.debug("[RAW_LLM_OUT %s attempt=%d] len=%d tokens=%s %.500s",
                     context, attempt, len(raw), usage_dict, raw)
        try:
            parsed = parse_fn(raw)
            return parsed, raw, usage_dict
        except ValueError as e:
            if attempt == 1:
                logger.warning("[RETRY] Parse failed attempt 1 (%s) - retrying…", e)
                messages = list(messages) + [{"role": "user", "content":
                    "Your previous response was not valid JSON. "
                    "Output ONLY the raw JSON object. Start with { end with }. No markdown."}]
            else:
                logger.error("[RETRY] Parse failed again attempt 2: %s", e)
                raise


def _detect_mime(image_bytes: bytes, fallback_mime: str) -> str:
    """
    Detect MIME type from the first bytes of image data using magic numbers.
    No external dependencies — works on all Python 3.9+ builds.

    Image encoding used throughout: standard base64 (RFC 4648),
    decoded to a UTF-8 string and embedded as a data-URI:
        data:<mime>;base64,<b64string>
    """
    MAGIC: list[tuple[bytes, str]] = [
        (b'\x89PNG\r\n\x1a\n',         'image/png'),
        (b'\xff\xd8\xff',               'image/jpeg'),
        (b'RIFF',                        'image/webp'),   # checked with offset 8 below
        (b'GIF87a',                      'image/gif'),
        (b'GIF89a',                      'image/gif'),
        (b'BM',                          'image/bmp'),
        (b'\x00\x00\x01\x00',           'image/x-icon'),
    ]
    h = image_bytes[:16] if len(image_bytes) >= 16 else image_bytes

    # WebP: bytes 0-3 == RIFF and bytes 8-11 == WEBP
    if h[:4] == b'RIFF' and h[8:12] == b'WEBP':
        logger.info("[IMAGE_MIME] Detected=webp via magic bytes")
        return 'image/webp'

    for magic, mime in MAGIC:
        if magic == b'RIFF':
            continue   # handled above
        if h[:len(magic)] == magic:
            logger.info("[IMAGE_MIME] Detected=%s via magic bytes (fallback was %s)",
                        mime, fallback_mime)
            return mime

    # Normalise fallback
    mime = (fallback_mime or '').lower().strip()
    if mime == 'image/jpg':
        return 'image/jpeg'
    if mime in {'image/png', 'image/jpeg', 'image/webp',
                'image/gif', 'image/bmp', 'image/svg+xml'}:
        return mime

    logger.warning("[IMAGE_MIME] Unknown mime=%r — defaulting to image/png", mime)
    return 'image/png'


# ── Public functions ──────────────────────────────────────────────────────────
def generate_website(prompt: str,
                     style_preferences: dict | None = None
                     ) -> tuple[WebsiteOutput, str, dict, Any]:
    logger.info("[PROMPT_IN] prompt=%.200s | image=no | style_prefs=%s",
                prompt, style_preferences)

    # Use Langfuse Prompt Management with local fallback
    sys_prompt_obj = get_langfuse_prompt("website-generator-base", GENERATE_SYSTEM)
    sys_compiled = sys_prompt_obj if isinstance(sys_prompt_obj, str) else sys_prompt_obj.compile()

    system = sys_compiled + _rag_note(prompt, style_preferences)
    logger.debug("[SYSTEM_PROMPT generate]\n%s", system)
    user_msg = f"Create a website: {prompt}{_style_note(style_preferences)}\n\nOutput ONLY the raw JSON."
    logger.debug("[USER_MSG generate] %.400s", user_msg)

    site, raw, usage = _call_with_retry(
        [{"role": "system", "content": system},
         {"role": "user",   "content": user_msg}],
        TEXT_MODEL, 8000, _parse_website, "generate")

    logger.info("[SECTIONS_SENT generate] %s",
                [{"name": s.section, "htmlChars": len(s.html), "cssChars": len(s.css)}
                 for s in site.sections])
    return site, raw, usage, sys_prompt_obj


def refine_website(prompt: str,
                   current_sections: list[SectionPatch],
                   title: str,
                   style_preferences: dict | None = None
                   ) -> tuple[RefinementOutput, str, dict, Any]:
    logger.info("[PROMPT_IN refine] prompt=%.200s | sections=%s | style_prefs=%s",
                prompt, [s.section for s in current_sections], style_preferences)

    # Use Langfuse Prompt Management with local fallback
    sys_prompt_obj = get_langfuse_prompt("website-refiner-base", REFINE_SYSTEM)
    sys_compiled = sys_prompt_obj if isinstance(sys_prompt_obj, str) else sys_prompt_obj.compile()

    system = sys_compiled + _rag_note(prompt, style_preferences)
    logger.debug("[SYSTEM_PROMPT refine]\n%s", system)

    # BUG FIX: send FULL html/css — not truncated — so LLM understands the whole site
    sections_ctx = "\n\n".join(
        f"### {s.section}\nHTML:\n{s.html}\nCSS:\n{s.css}"
        for s in current_sections
    )
    user_msg = (
        f"Title: {title}\n"
        f"Current sections (FULL source):\n{sections_ctx}\n\n"
        f"User request: {prompt}{_style_note(style_preferences)}\n\n"
        f"Return ONLY the JSON with changed_sections and unchanged_section_names."
    )
    logger.debug("[USER_MSG refine] %.400s", user_msg)

    result, raw, usage = _call_with_retry(
        [{"role": "system", "content": system},
         {"role": "user",   "content": user_msg}],
        TEXT_MODEL, 6000, _parse_refinement, "refine")

    logger.info("[REFINE_DIFF] received=%s changed=%s unchanged=%s",
                [s.section for s in current_sections],
                [s.section for s in result.changed_sections],
                result.unchanged_section_names)
    return result, raw, usage, sys_prompt_obj


def generate_website_from_image(prompt: str,
                                image_bytes: bytes,
                                mime_type: str,
                                style_preferences: dict | None = None
                                ) -> tuple[WebsiteOutput, str, dict, Any]:
    logger.info("[PROMPT_IN vision] prompt=%.200s | mime=%s | style_prefs=%s",
                prompt, mime_type, style_preferences)

    # Detect real MIME from bytes (image/jpg → image/jpeg, etc.)
    mime_type = _detect_mime(image_bytes, mime_type)
    logger.info("[IMAGE_ENCODING] scheme=%s | mime=%s | bytes=%d | b64_len=%d",
                IMAGE_ENCODING, mime_type, len(image_bytes),
                len(base64.b64encode(image_bytes)))

    # Use Langfuse Prompt Management with local fallback
    sys_prompt_obj = get_langfuse_prompt("website-generator-base", GENERATE_SYSTEM)
    sys_compiled = sys_prompt_obj if isinstance(sys_prompt_obj, str) else sys_prompt_obj.compile()

    system = sys_compiled + _rag_note(prompt, style_preferences)
    logger.debug("[SYSTEM_PROMPT vision]\n%s", system)

    # Encode image as standard base64 (RFC 4648), decoded to UTF-8 string
    b64_str  = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_str}"

    vision_prompt = (
        "Carefully analyze this screenshot/sketch and extract:\n"
        "1. Layout: column count, flex/grid structure, section order (top to bottom)\n"
        "2. Colors: EXACT hex codes for backgrounds, text, buttons, borders, accents\n"
        "3. Fonts: heading vs body weight, approximate sizes, style (serif/sans/mono)\n"
        "4. Spacing: section padding, element gaps, margins\n"
        "5. Components: navbar type (sticky/fixed/transparent), hero alignment (center/left), card grid columns\n"
        "6. Backgrounds: solid color / gradient / image / glassmorphism\n"
        "7. Special elements: icons, badges, illustrations, video embeds\n"
        "8. Buttons: shape (pill/rounded/square), color, shadow, hover state\n"
        "9. Overall design language: minimal / dark / vibrant / corporate / editorial\n\n"
        "Then REPLICATE this design as faithfully as possible using real HTML/CSS.\n"
        "Match the exact color scheme, layout structure, and typography hierarchy from the image.\n"
        f"Additional user instructions: {prompt}{_style_note(style_preferences)}\n\n"
        "Return ONLY the raw WebsiteOutput JSON."
    )
    logger.debug("[VISION_PROMPT] %s", vision_prompt)

    site, raw, usage = _call_with_retry(
        [{"role": "system", "content": system},
         {"role": "user", "content": [
             {"type": "image_url", "image_url": {"url": data_url}},
             {"type": "text",      "text": vision_prompt}]}],
        VISION_MODEL, 8192, _parse_website, "vision")

    logger.info("[SECTIONS_SENT vision] %s",
                [{"name": s.section, "htmlChars": len(s.html), "cssChars": len(s.css)}
                 for s in site.sections])
    return site, raw, usage, sys_prompt_obj
