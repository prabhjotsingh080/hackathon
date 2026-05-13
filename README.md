# GenAI Website Builder

A full-stack AI-powered tool that generates, refines, and replaces live HTML/CSS/JS websites from text prompts or image sketches — powered by Groq's ultra-fast LLM inference with a **surgical patch-based refinement architecture** and RAG-powered design inspiration.

## Features

### Tier 1 — Core Generation
| Feature | Details |
|---------|---------|
| **Text → Website** | Describe any site → full HTML/CSS/JS in 3–8 s via Groq |
| **Section-aware output** | LLM returns named sections (navbar, hero, features, pricing, testimonials, cta, footer) |
| **Version History** | Every generation stored; click any version to instantly restore |
| **Style Controls** | Palette (5 options) + Font (5 options, each label rendered in its own typeface) + Layout picker |
| **Visually rich output** | Mandatory system prompt rules: gradients, scoped CSS, real content, no lorem ipsum |

### Tier 2 — Patch-Based Refinement & Multimodal
| Feature | Details |
|---------|---------|
| **Surgical Refinement** | Follow-up prompts via `/refine` — only changed sections returned and merged |
| **Order-preserving merge** | Merge iterates `currentSections` order as source of truth; never reorders |
| **Section flash** | Yellow outline flashes on changed sections after refinement |
| **Refine fallback** | If refinement parse fails → auto full regen, flagged in Langfuse |
| **Sketch-to-Site (vision)** | Upload wireframe/screenshot → 8-step analysis prompt replicates exact layout + colors |
| **CSS scoping** | `scopeCSS()` helper prefixes every rule with `#section-{name}` to prevent conflicts |
| **Retry on parse fail** | LLM calls retry once with JSON correction nudge before raising |

### Tier 3 — RAG Design Inspiration
| Feature | Details |
|---------|---------|
| **Design RAG** | `rag.py` hardcoded vector store: 10 snippets covering hero, navbar, cards, pricing, testimonials, footer, forms, CTA, color palettes, mobile-first patterns |
| **Keyword retrieval** | `retrieve_design_context(prompt)` keyword-matches prompt against tags, injects top 2–3 CSS snippets into every LLM system prompt |
| **Design quality uplift** | Retrieved snippets give LLM concrete CSS patterns (gradients, spacing, hover states) to reference |

### Observability & DX
| Feature | Details |
|---------|---------|
| **Langfuse tracing** | Every call traced with mode, tokens, latency, section count, fallback flag |
| **Exhaustive backend logging** | `[PROMPT_IN]` `[SYSTEM_PROMPT]` `[RAW_LLM_OUT]` `[PARSE_ATTEMPT]` `[PARSE_SUCCESS]` `[PARSE_FAIL]` `[SECTIONS_SENT]` `[REFINE_DIFF]` `[FALLBACK]` `[LANGFUSE_SENT]` |
| **Frontend debug logging** | `[REQUEST_SENT]` `[RESPONSE_RAW]` `[SECTIONS_RECEIVED]` `[MERGE_*]` `[ASSEMBLED_HTML]` `[CSS_SCOPED]` |
| **Debug Panel** | `?debug=true` in URL reveals collapsible bottom-left overlay with request/response/assembly stats + "Copy Assembled HTML" + "Copy System Prompt" |
| **Iframe sandbox fix** | `allow-scripts allow-same-origin allow-forms allow-modals` — Google Fonts and JS both work |

### UX Polish
| Feature | Details |
|---------|---------|
| **Ctrl+Enter / Cmd+Enter** | Keyboard shortcut to submit prompt |
| **Copy HTML button** | In chat header — copies full assembled HTML to clipboard |
| **Token count + time** | Shown below every assistant message |
| **Section-aware loading** | Spinner labels differ for generate / refine / vision |
| **Responsive layout** | Works on tablet viewports (35% / 65% split, min-width guards) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (User)                          │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS
          ┌─────────────────▼─────────────────┐
          │        Vercel (Frontend)           │
          │  React 18 + Vite + Tailwind CSS    │
          │                                    │
          │  ChatPanel  │  PreviewPanel         │
          │  StyleControls  VersionHistory      │
          │  DebugPanel  (dev + ?debug=true)    │
          │  useWebsiteBuilder (hook)           │
          └──────┬────────────────┬────────────┘
                 │ POST /generate │ POST /refine
                 │ POST /generate-vision
          ┌──────▼────────────────▼────────────┐
          │        Render (Backend)             │
          │  FastAPI v2.1                       │
          │                                    │
          │  /generate  ──► agent.py           │
          │  /refine    ──► agent.py           │  ──► Langfuse
          │  /generate-vision ► agent.py       │
          │  /health    ──► { status: ok }     │
          │                                    │
          │  agent.py ──► rag.py (RAG inject)  │
          │           ──► Groq LLM (+ retry)   │
          └────────────────────────────────────┘
```

### Patch-based refinement flow

```
User prompt ──► POST /refine
                    │
                    ├─► RAG retrieves design snippets → injected into system prompt
                    ├─► LLM returns RefinementOutput
                    │     changed_sections: [hero, cta]
                    │     unchanged_section_names: [navbar, footer]
                    │
                    ├─► mergeSections() — iterates currentSections order
                    │     replace changed, keep unchanged, never reorder
                    │
                    ├─► assembleSections() — CSS scoped per section
                    │
                    └─► iframe updates, changed sections flash yellow
```

---

## API Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET`  | `/health` | — | `{ status: "ok" }` |
| `POST` | `/generate` | `GenerateRequest` (JSON) | `WebsiteOutput` |
| `POST` | `/refine`   | `RefineRequest` (JSON)   | `RefinementOutput` |
| `POST` | `/generate-vision` | multipart: `prompt`, `image`, `style_preferences` | `WebsiteOutput` |

Add `?debug=true` to any endpoint to receive `debug_system_prompt` in the response.

### Error codes
| Code | Meaning |
|------|---------|
| 400 | Empty or whitespace-only prompt |
| 415 | Uploaded file is not a supported image type |
| 422 | LLM returned malformed JSON (after retry) |
| 503 | Groq API unavailable |

### Key schemas

```python
class SectionPatch(BaseModel):
    section: str        # "navbar" | "hero" | "features" | "cta" | "footer" | ...
    html: str
    css: str
    js: str | None

class WebsiteOutput(BaseModel):
    title: str
    sections: list[SectionPatch]
    full_html: str
    full_css: str
    full_js: str
    generation_time_ms: float
    token_count: int
    debug_system_prompt: str | None   # populated when ?debug=true

class RefinementOutput(BaseModel):
    title: str
    changed_sections: list[SectionPatch]
    unchanged_section_names: list[str]
    generation_time_ms: float
    token_count: int
    fallback: bool
    debug_system_prompt: str | None
```

---

## Local Setup

### Prerequisites
- Python ≥ 3.12, Node.js ≥ 18, a Groq API key

### 1 — Backend
```bash
cd backend
cp .env.example .env
# Edit .env — add your GROQ_API_KEY
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Swagger UI: **http://localhost:8000/docs**

### 2 — Frontend
```bash
cd frontend
cp .env.example .env.local
# VITE_API_URL defaults to http://localhost:8000 if unset
npm install
npm run dev
```
App: **http://localhost:5173**  
Debug mode: **http://localhost:5173/?debug=true**

### 3 — Quick curl tests

```bash
# Generate
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a landing page for wireless earbuds"}'

# Generate with debug system prompt
curl -X POST "http://localhost:8000/generate?debug=true" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a SaaS landing page"}'

# Refine (surgical patch)
curl -X POST http://localhost:8000/refine \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "make the hero section dark with neon accents",
    "title": "EarPods Pro",
    "current_sections": [
      {"section":"hero","html":"<section id=hero><h1>EarPods</h1></section>","css":"#hero{background:#fff}"}
    ]
  }'

# Vision (sketch-to-site)
curl -X POST http://localhost:8000/generate-vision \
  -F "prompt=replicate this UI for earbuds" \
  -F "image=@sketch.png"
```

---

## Where logs are stored

**Backend logs** — printed to **stdout/stderr** of the uvicorn process (terminal). In production on Render they appear in the **Render dashboard → Logs tab**. To persist to a file locally:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | tee backend.log
```
All log lines follow the format: `TIMESTAMP [LEVEL] module — [TAG] message`  
Key tags: `[PROMPT_IN]` `[SYSTEM_PROMPT]` `[RAW_LLM_OUT]` `[PARSE_SUCCESS]` `[PARSE_FAIL]` `[SECTIONS_SENT]` `[REFINE_DIFF]` `[FALLBACK]` `[LANGFUSE_SENT]` `[RAG]` `[RETRY]`

**Frontend logs** — browser **DevTools → Console** tab.  
Key tags: `[WEBSITE_BUILDER]` `[REQUEST_SENT]` `[RESPONSE_RAW]` `[SECTIONS_RECEIVED]` `[MERGE_BEFORE/AFTER]` `[ASSEMBLED_HTML]` `[CSS_SCOPED]` `[JS_SECTIONS]` `[IFRAME_LOAD]`

**Langfuse traces** — https://cloud.langfuse.com (requires `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` in `.env`)

---

## Deployment

### Backend → Render

1. Connect repo to [Render](https://render.com) — auto-detects `render.yaml`
2. Set environment variables:

   | Key | Value |
   |-----|-------|
   | `GROQ_API_KEY` | `gsk_…` |
   | `LANGFUSE_PUBLIC_KEY` | `pk-lf-…` (optional) |
   | `LANGFUSE_SECRET_KEY` | `sk-lf-…` (optional) |
   | `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` |
   | `ALLOWED_ORIGIN` | *(set after Vercel deploy)* |

3. Note the URL: `https://your-service.onrender.com`

### Frontend → Vercel

1. Import repo to [Vercel](https://vercel.com), set **Root Directory** = `frontend`
2. Set `VITE_API_URL` = your Render URL
3. Deploy → note Vercel URL → update `ALLOWED_ORIGIN` in Render → redeploy

---

## Project Structure

```
hackathon/
├── backend/
│   ├── main.py          # FastAPI: /generate, /refine, /generate-vision, /health
│   ├── agent.py         # Groq client — generate, refine, vision + retry logic
│   ├── rag.py           # RAG: 10 design snippets + keyword retrieval
│   ├── schemas.py       # SectionPatch, WebsiteOutput, RefinementOutput, ...
│   ├── tracer.py        # Langfuse tracing
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html       # Preloads all 5 Google Fonts
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── ChatPanel.jsx       # Prompt input, Ctrl+Enter, Copy HTML, image upload
│       │   ├── PreviewPanel.jsx    # iframe + sandbox fix + section flash
│       │   ├── MessageBubble.jsx   # Chat bubbles with token/time metadata footer
│       │   ├── StyleControls.jsx   # Palette / font (rendered in own typeface) / layout
│       │   ├── VersionHistory.jsx  # Slide-in version drawer
│       │   └── DebugPanel.jsx      # Dev-only debug overlay (?debug=true)
│       ├── hooks/
│       │   └── useWebsiteBuilder.js  # All state, API routing, order-preserving merge
│       └── utils/
│           └── combineHTML.js        # assembleSections (CSS scoping) + combineHTML
├── render.yaml
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------| 
| LLM (text) | Groq — `llama-3.3-70b-versatile` |
| LLM (vision) | Groq — `meta-llama/llama-4-scout-17b-16e-instruct` |
| API | FastAPI + Pydantic v2 |
| RAG | In-memory keyword retrieval (`rag.py`) |
| Tracing | Langfuse |
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend hosting | Render |
| Frontend hosting | Vercel |

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| **Token budget** | `llama-3.3-70b-versatile` at 8 000 tokens can truncate very large sites (6+ sections with heavy JS) |
| **Vision model context** | `llama-4-scout` may miss fine detail in complex screenshots; prompt explicitly asks for hex codes |
| **RAG is keyword-only** | No embeddings — retrieval degrades on abstract or metaphorical prompts |
| **No streaming** | Full response awaited before rendering; sites with many sections may feel slow |
| **CSS scoping regex** | `scopeCSS()` is regex-based and may mis-scope edge cases with deeply nested at-rules |
| **Render cold start** | Free tier Render instances sleep after inactivity — first request after idle takes ~30 s |
| **No auth** | API endpoints are open — add an API key header before production use |

---

## Developer Reflection

> *[PLACEHOLDER — fill in before submission]*  
> What broke: ...  
> What surprised me: ...  
> If I had another week: ...

---

## 5-Minute Demo Script

### Best prompt to open with
> *"A dark SaaS landing page for an AI writing tool called Quillify. Dark purple theme, Poppins font, hero section with gradient headline, 3-feature card grid, pricing table with a highlighted Pro plan, and a CTA with email capture."*

This prompt hits: RAG (hero + pricing + CTA snippets retrieved), style controls (dark palette + Poppins font pre-selected), and all 6+ sections.

### Architecture slide talking points
1. **Patch architecture**: Show `/refine` returning only changed sections — not a full page reload
2. **RAG injection**: Open backend logs → show `[RAG]` line listing which design snippets were retrieved
3. **CSS scoping**: Open DevTools Elements tab → show `#section-hero .hero-title` scoped selectors
4. **Debug panel**: Add `?debug=true` → show live HTML stats + copy assembled HTML

### Follow-up refinement to demo
> *"Make the hero section neon green on black, like a hacker terminal"*

Shows only hero section flashing yellow (section-level patch), other sections unchanged.

### What you'd build next
- **Streaming generation** with per-section progressive rendering
- **Component library RAG** with real Figma/Tailwind component embeddings
- **Export to GitHub** — push generated site as a deployable repo
- **Multi-page generation** — generate linked pages with shared navbar/footer
