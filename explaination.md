# GenAI Website Builder — Technical Deep Dive

This document explains the architecture, file interactions, and core mechanisms of the GenAI Website Builder. It is designed for software engineers looking to understand how the system works from end to end.

## 🏗️ High-Level Architecture

The project follows a modern Client-Server architecture:
- **Frontend**: A React application (Vite) that manages state, versioning, and real-time website assembly.
- **Backend**: A FastAPI (Python) server that orchestrates LLM calls, RAG retrieval, and observability.
- **LLM Engine**: Powered by Groq (Llama 3.3 70B for text, Llama 4 Scout 17B for vision).

---

## 🚀 Core Technical Pillars

### 1. Patch-Based Refinement (Surgical Updates)
Unlike traditional "regenerate everything" builders, this system treats a website as a collection of independent sections (navbar, hero, features, etc.).
- **Backend (`agent.py`)**: When a user asks for a change (e.g., "make the hero red"), the LLM returns only the `changed_sections` and a list of `unchanged_section_names`.
- **Frontend (`useWebsiteBuilder.js`)**: The `mergeSections` function replaces only the modified sections in the application state. This results in faster generations and a smoother UI experience (no flicker on unchanged parts).

### 2. Automatic CSS Scoping
To prevent style collisions between different sections or versions, the system implements a custom CSS scoping engine.
- **Mechanism (`combineHTML.js`)**: 
    1. Every section is wrapped in a `<div id="section-{name}">`.
    2. The CSS scoping function parses the LLM-generated CSS and prefixes every selector with the section's unique ID (e.g., `.title` becomes `#section-hero .title`).
    3. Global rules like `@import` or `@keyframes` are hoisted to the top level.

### 3. RAG-Powered Design Inspiration
To ensure the LLM generates "premium" designs rather than generic 2010-era HTML, we use a lightweight RAG (Retrieval-Augmented Generation) system.
- **Design Store (`rag.py`)**: A curated library of modern CSS snippets (gradients, glassmorphism, bento grids, typography patterns).
- **Retrieval**: The system keyword-matches the user's prompt against the design store and injects relevant CSS patterns into the LLM's system prompt as "inspiration."

### 4. Multimodal Vision-to-Code
Users can upload an image (screenshot or wireframe) to bootstrap a site.
- **Process (`main.py` -> `agent.py`)**: The image is base64-encoded and sent to a vision-capable LLM. The system prompt instructs the model to analyze layout, color hex codes, and spacing before outputting the structured JSON.

---

## 📂 File-by-File Breakdown

### Backend (`/backend`)
| File | Responsibility |
| :--- | :--- |
| `main.py` | FastAPI entry point. Defines `/generate`, `/refine`, and `/generate-vision` endpoints. |
| `agent.py` | The "brain." Handles Groq API calls, retries, JSON extraction, and system prompt construction. |
| `rag.py` | In-memory vector store of design snippets. Provides `retrieve_design_context` for prompt augmentation. |
| `tracer.py` | Langfuse integration. Logs every LLM call with latency, tokens, and metadata for observability. |
| `schemas.py` | Pydantic models (WebsiteOutput, SectionPatch) ensuring type safety between Python and JS. |

### Frontend (`/frontend/src`)
| File | Responsibility |
| :--- | :--- |
| `hooks/useWebsiteBuilder.js` | The central state machine. Manages messages, site versions, and the complex logic for merging patches. |
| `utils/combineHTML.js` | The "assembler." Combines sections, applies CSS scoping, and returns a standalone `<!DOCTYPE html>` string. |
| `App.jsx` | Root component that orchestrates the `ChatPanel`, `PreviewPanel`, and `DebugPanel`. |
| `components/PreviewPanel.jsx` | Renders the generated site inside an isolated `iframe` using the `srcdoc` attribute. |

---

## 🔄 Data Flow: A Single Request

1. **Input**: User types a prompt in the `ChatPanel`.
2. **Processing**: `useWebsiteBuilder.js` sends a POST request to the backend with the user prompt + current site state (if refining).
3. **Augmentation**: The backend (`rag.py`) finds relevant design snippets based on the prompt.
4. **LLM Generation**: Groq generates a JSON response containing HTML/CSS for specific sections.
5. **Merging**: The frontend receives the JSON and merges the new sections into the `currentSections` array.
6. **Assembly**: `combineHTML.js` walks through the sections, scopes the CSS, and builds a single HTML string.
7. **Rendering**: The `PreviewPanel` updates its `iframe` with the new HTML, and the change is traced in Langfuse.

---

## 🛠️ Observability & Debugging
- **Langfuse**: Every generation is logged. You can see exactly what system prompt was sent and how the model responded.
- **Debug Mode**: Appending `?debug=true` to the URL enables a `DebugPanel` in the UI that displays raw LLM output, token usage, and the final assembled HTML.
