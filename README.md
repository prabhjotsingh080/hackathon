# GenAI Website Builder

A full-stack AI-powered tool that generates complete, live HTML/CSS/JS websites from a single text prompt. Built for speed and quality using Groq's ultra-fast LLM inference.

## Overview

The GenAI Website Builder takes a natural-language description (e.g. *"a landing page for a SaaS chatbot"*) and returns a fully structured `WebsiteOutput` — with `title`, `html`, `css`, and `js` fields — rendered instantly in a split-pane React UI. Every LLM call is traced end-to-end in Langfuse for observability. The backend is a FastAPI service powered by the Agno agent framework wrapping Groq's `llama-3.3-70b-versatile` model; the frontend is a Vite + React + Tailwind SPA deployed to Vercel.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (User)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS
          ┌─────────────────▼──────────────────┐
          │        Vercel (Frontend)            │
          │   React + Vite + Tailwind CSS       │
          │                                     │
          │  ChatPanel │ PreviewPanel            │
          │  useWebsiteBuilder (hook)           │
          └─────────────────┬───────────────────┘
                            │  POST /generate
                            │  GET  /health
          ┌─────────────────▼───────────────────┐
          │        Render (Backend)             │
          │   FastAPI  +  Agno Agent            │
          │                                     │
          │  /generate ──► Agno ──► Groq API   │
          │  /health   ──► { status: ok }       │
          │                    │                │
          │                    ▼                │
          │             Langfuse (tracing)      │
          └─────────────────────────────────────┘
```

---

## Local Setup (5 steps)

### Prerequisites
- Python ≥ 3.12, Node.js ≥ 18, a Groq API key

### 1 — Clone & configure backend
```bash
cd backend
cp .env.example .env
# Fill in GROQ_API_KEY (and optionally Langfuse keys) in .env
```

### 2 — Install & run backend
```bash
# With uv (recommended)
uv pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Or plain pip
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Backend runs at **http://localhost:8000** — check **http://localhost:8000/docs** for the interactive API.

### 3 — Configure frontend
```bash
cd ../frontend
cp .env.example .env.local
# For local dev, VITE_API_URL is optional (defaults to http://localhost:8000)
```

### 4 — Install & run frontend
```bash
npm install
npm run dev
```
App opens at **http://localhost:3000**.

### 5 — Test end-to-end
```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a simple landing page for a chatbot"}'
```
Expected response shape:
```json
{ "title": "...", "html": "...", "css": "...", "js": "..." }
```

---

## Deployment

### Backend → Render

1. Push this repo to GitHub.
2. In [Render](https://render.com), create a new **Web Service** → **Connect repository**.
3. Render auto-detects `render.yaml` in the repo root. Confirm settings:
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port 10000`
4. Set **Environment Variables** in the Render dashboard:

   | Key | Value |
   |-----|-------|
   | `GROQ_API_KEY` | `gsk_…` |
   | `LANGFUSE_PUBLIC_KEY` | `pk-lf-…` |
   | `LANGFUSE_SECRET_KEY` | `sk-lf-…` |
   | `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` |
   | `ALLOWED_ORIGIN` | *(set after Vercel deploy — your Vercel URL)* |

5. Deploy. Note your public URL: `https://your-service.onrender.com`.

---

### Frontend → Vercel

1. In [Vercel](https://vercel.com), create a new project → import from GitHub.
2. Set **Root Directory** to `frontend`.
3. Set **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://your-service.onrender.com` |

4. Deploy. Note your Vercel URL: `https://your-app.vercel.app`.
5. Go back to **Render → Environment** and set `ALLOWED_ORIGIN` to your Vercel URL, then redeploy.

---

## Project Structure

```
hackathon/
├── backend/
│   ├── main.py          # FastAPI app (CORS, /generate, /health)
│   ├── agent.py         # Agno agent wrapping Groq llama-3.3-70b-versatile
│   ├── schemas.py       # Pydantic models (WebsiteOutput, GenerateRequest)
│   ├── tracer.py        # Langfuse tracing (trace_llm_call)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── PreviewPanel.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   └── StyleControls.jsx
│   │   ├── hooks/
│   │   │   └── useWebsiteBuilder.js
│   │   └── utils/
│   │       └── combineHTML.js
│   ├── vercel.json
│   └── .env.example
├── render.yaml
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Groq — `llama-3.3-70b-versatile` |
| Agent framework | Agno |
| API | FastAPI + Pydantic |
| Tracing | Langfuse |
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend hosting | Render |
| Frontend hosting | Vercel |
