"""
rag.py — Lightweight RAG-powered design inspiration retrieval.

Uses a hardcoded in-memory vector store (list of dicts).
retrieve_design_context(prompt) returns the top 2-3 CSS/design snippets
most relevant to the user's prompt, injected into every LLM system prompt.
"""
import logging
import re

logger = logging.getLogger(__name__)

# ── Design inspiration snippets ───────────────────────────────────────────────
DESIGN_STORE: list[dict] = [
    {
        "tags": ["hero", "landing", "gradient", "headline", "cta", "fullscreen"],
        "description": "Dark gradient hero section with large headline and pill CTA button",
        "css_snippet": (
            ".hero-section { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); "
            "padding: 120px 40px; text-align: center; } "
            ".hero-title { font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 800; "
            "color: #fff; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 24px; } "
            ".hero-subtitle { font-size: 1.2rem; color: rgba(255,255,255,0.65); max-width: 560px; "
            "margin: 0 auto 40px; line-height: 1.7; } "
            ".hero-cta { display: inline-block; background: linear-gradient(90deg,#6366f1,#8b5cf6); "
            "color: #fff; padding: 16px 40px; border-radius: 9999px; font-weight: 700; "
            "font-size: 1rem; text-decoration: none; "
            "box-shadow: 0 8px 32px rgba(99,102,241,0.4); "
            "transition: transform 0.2s, box-shadow 0.2s; } "
            ".hero-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(99,102,241,0.6); }"
        ),
    },
    {
        "tags": ["navbar", "navigation", "header", "sticky", "logo", "links"],
        "description": "Sticky navbar with logo left, nav links right, glassmorphism background",
        "css_snippet": (
            ".navbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; "
            "justify-content: space-between; padding: 16px 48px; "
            "background: rgba(15,12,41,0.8); backdrop-filter: blur(12px); "
            "border-bottom: 1px solid rgba(255,255,255,0.08); } "
            ".navbar-logo { font-size: 1.3rem; font-weight: 800; color: #fff; } "
            ".navbar-links { display: flex; gap: 32px; list-style: none; } "
            ".navbar-link { color: rgba(255,255,255,0.65); text-decoration: none; font-size: 0.9rem; "
            "font-weight: 500; transition: color 0.2s; } "
            ".navbar-link:hover { color: #fff; } "
            ".navbar-cta { background: #6366f1; color: #fff; padding: 8px 20px; "
            "border-radius: 8px; font-weight: 600; text-decoration: none; "
            "transition: background 0.2s; } "
            ".navbar-cta:hover { background: #4f46e5; }"
        ),
    },
    {
        "tags": ["features", "cards", "grid", "icons", "bento", "services"],
        "description": "3-column feature card grid with icon, heading and description",
        "css_snippet": (
            ".features-section { background: #f8fafc; padding: 96px 48px; } "
            ".features-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); "
            "gap: 28px; max-width: 1100px; margin: 0 auto; } "
            ".features-card { background: #fff; border-radius: 16px; padding: 36px 28px; "
            "border: 1px solid #e2e8f0; "
            "box-shadow: 0 2px 12px rgba(0,0,0,0.04); "
            "transition: transform 0.2s, box-shadow 0.2s; } "
            ".features-card:hover { transform: translateY(-4px); "
            "box-shadow: 0 12px 32px rgba(99,102,241,0.1); } "
            ".features-icon { width: 52px; height: 52px; border-radius: 14px; "
            "background: linear-gradient(135deg, #6366f1, #8b5cf6); "
            "display: flex; align-items: center; justify-content: center; "
            "margin-bottom: 20px; font-size: 1.4rem; } "
            ".features-card-title { font-size: 1.15rem; font-weight: 700; "
            "color: #0f172a; margin-bottom: 10px; } "
            ".features-card-desc { color: #64748b; font-size: 0.9rem; line-height: 1.7; }"
        ),
    },
    {
        "tags": ["color", "palette", "dark", "vibrant", "gradient", "purple", "indigo"],
        "description": "Dark purple-indigo gradient palette — great for tech/SaaS products",
        "css_snippet": (
            "/* Palette: dark bg #0f0c29 | accent #6366f1 | surface #1e293b | "
            "text-primary #f1f5f9 | text-muted #94a3b8 */ "
            "body { background: #0f0c29; color: #f1f5f9; font-family: 'Inter',sans-serif; } "
            "h1,h2,h3 { color: #fff; } "
            "p { color: #94a3b8; } "
            "a { color: #818cf8; } "
            ".accent-bg { background: linear-gradient(135deg,#6366f1,#8b5cf6); } "
            ".surface { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); "
            "border-radius: 12px; }"
        ),
    },
    {
        "tags": ["cta", "call to action", "banner", "signup", "conversion", "email"],
        "description": "Full-width CTA banner with email input and gradient background",
        "css_snippet": (
            ".cta-section { background: linear-gradient(135deg,#4f46e5,#7c3aed); "
            "padding: 80px 48px; text-align: center; } "
            ".cta-title { font-size: clamp(1.8rem,3vw,3rem); font-weight: 800; "
            "color: #fff; margin-bottom: 16px; } "
            ".cta-sub { color: rgba(255,255,255,0.75); font-size: 1.1rem; margin-bottom: 36px; } "
            ".cta-form { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; } "
            ".cta-input { padding: 14px 20px; border-radius: 10px; border: none; "
            "font-size: 0.95rem; width: 300px; outline: none; "
            "background: rgba(255,255,255,0.15); color: #fff; } "
            ".cta-input::placeholder { color: rgba(255,255,255,0.5); } "
            ".cta-btn { padding: 14px 32px; background: #fff; color: #4f46e5; "
            "border-radius: 10px; border: none; font-weight: 700; font-size: 0.95rem; "
            "cursor: pointer; transition: background 0.2s, transform 0.2s; } "
            ".cta-btn:hover { background: #e0e7ff; transform: scale(1.03); }"
        ),
    },
    {
        "tags": ["footer", "bottom", "links", "social", "copyright", "sitemap"],
        "description": "Dark multi-column footer with sitemap columns and social icons",
        "css_snippet": (
            ".footer { background: #0a0a14; padding: 72px 48px 32px; } "
            ".footer-grid { display: grid; grid-template-columns: 2fr repeat(3,1fr); "
            "gap: 48px; max-width: 1100px; margin: 0 auto 48px; } "
            ".footer-brand { font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px; } "
            ".footer-tagline { color: #64748b; font-size: 0.85rem; line-height: 1.7; } "
            ".footer-col-title { color: #fff; font-weight: 600; font-size: 0.85rem; "
            "text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; } "
            ".footer-link { display: block; color: #64748b; font-size: 0.85rem; "
            "text-decoration: none; margin-bottom: 10px; transition: color 0.2s; } "
            ".footer-link:hover { color: #e2e8f0; } "
            ".footer-bottom { border-top: 1px solid #1e293b; padding-top: 24px; "
            "text-align: center; color: #334155; font-size: 0.8rem; }"
        ),
    },
    {
        "tags": ["form", "contact", "input", "submit", "fields", "label"],
        "description": "Clean contact form with floating labels and focus states",
        "css_snippet": (
            ".form-section { background: #fff; padding: 80px 48px; } "
            ".form-card { max-width: 560px; margin: 0 auto; background: #f8fafc; "
            "border-radius: 20px; padding: 48px; border: 1px solid #e2e8f0; } "
            ".form-group { margin-bottom: 24px; } "
            ".form-label { display: block; font-size: 0.85rem; font-weight: 600; "
            "color: #374151; margin-bottom: 8px; } "
            ".form-input { width: 100%; padding: 12px 16px; border: 1.5px solid #d1d5db; "
            "border-radius: 10px; font-size: 0.95rem; color: #111; "
            "transition: border-color 0.2s, box-shadow 0.2s; outline: none; } "
            ".form-input:focus { border-color: #6366f1; "
            "box-shadow: 0 0 0 3px rgba(99,102,241,0.15); } "
            ".form-submit { width: 100%; padding: 14px; background: #6366f1; "
            "color: #fff; border: none; border-radius: 10px; font-size: 1rem; "
            "font-weight: 700; cursor: pointer; transition: background 0.2s; } "
            ".form-submit:hover { background: #4f46e5; }"
        ),
    },
    {
        "tags": ["pricing", "plans", "tiers", "table", "cards", "monthly", "annual"],
        "description": "3-tier pricing table with highlighted popular plan",
        "css_snippet": (
            ".pricing-section { background: #f8fafc; padding: 96px 48px; text-align: center; } "
            ".pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); "
            "gap: 24px; max-width: 960px; margin: 48px auto 0; } "
            ".pricing-card { background: #fff; border: 1.5px solid #e2e8f0; "
            "border-radius: 20px; padding: 40px 32px; transition: transform 0.2s; } "
            ".pricing-card:hover { transform: translateY(-4px); } "
            ".pricing-card.featured { background: linear-gradient(135deg,#4f46e5,#7c3aed); "
            "border-color: transparent; color: #fff; transform: scale(1.05); "
            "box-shadow: 0 20px 60px rgba(99,102,241,0.35); } "
            ".pricing-plan { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; "
            "letter-spacing: 0.1em; color: #6366f1; margin-bottom: 8px; } "
            ".pricing-card.featured .pricing-plan { color: rgba(255,255,255,0.7); } "
            ".pricing-price { font-size: 3rem; font-weight: 800; color: #0f172a; } "
            ".pricing-card.featured .pricing-price { color: #fff; } "
            ".pricing-period { font-size: 0.9rem; color: #94a3b8; } "
            ".pricing-btn { display: block; margin-top: 28px; padding: 12px 0; "
            "border-radius: 10px; font-weight: 600; text-align: center; "
            "background: #6366f1; color: #fff; text-decoration: none; "
            "transition: background 0.2s; } "
            ".pricing-card.featured .pricing-btn { background: rgba(255,255,255,0.2); } "
            ".pricing-btn:hover { background: #4f46e5; }"
        ),
    },
    {
        "tags": ["testimonials", "reviews", "social proof", "quotes", "customers"],
        "description": "Testimonial card carousel with avatar, name, and star rating",
        "css_snippet": (
            ".testimonials-section { background: #0f172a; padding: 96px 48px; } "
            ".testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(300px,1fr)); "
            "gap: 24px; max-width: 1100px; margin: 0 auto; } "
            ".testimonial-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); "
            "border-radius: 16px; padding: 32px; transition: border-color 0.3s; } "
            ".testimonial-card:hover { border-color: rgba(99,102,241,0.4); } "
            ".testimonial-stars { color: #fbbf24; font-size: 1rem; margin-bottom: 16px; "
            "letter-spacing: 2px; } "
            ".testimonial-text { color: #cbd5e1; font-size: 0.95rem; line-height: 1.8; "
            "font-style: italic; margin-bottom: 24px; } "
            ".testimonial-author { display: flex; align-items: center; gap: 12px; } "
            ".testimonial-avatar { width: 44px; height: 44px; border-radius: 50%; "
            "background: linear-gradient(135deg,#6366f1,#8b5cf6); "
            "display: flex; align-items: center; justify-content: center; "
            "font-weight: 700; color: #fff; font-size: 1rem; } "
            ".testimonial-name { color: #f1f5f9; font-weight: 600; font-size: 0.9rem; } "
            ".testimonial-role { color: #64748b; font-size: 0.8rem; }"
        ),
    },
    {
        "tags": ["mobile", "responsive", "breakpoints", "tablet", "flex", "adaptive"],
        "description": "Mobile-first responsive utility patterns for flex/grid layouts",
        "css_snippet": (
            "/* Mobile-first breakpoints */ "
            "@media (max-width: 768px) { "
            "  .features-grid { grid-template-columns: 1fr; } "
            "  .pricing-grid { grid-template-columns: 1fr; } "
            "  .footer-grid { grid-template-columns: 1fr; gap: 32px; } "
            "  .navbar { padding: 14px 20px; } "
            "  .navbar-links { display: none; } "
            "  .hero-section { padding: 80px 24px; } "
            "  .hero-title { font-size: 2.2rem; } "
            "  .cta-form { flex-direction: column; align-items: center; } "
            "  .cta-input { width: 100%; } "
            "  .pricing-card.featured { transform: scale(1); } "
            "} "
            "@media (max-width: 480px) { "
            "  .hero-title { font-size: 1.8rem; } "
            "  .features-section, .pricing-section { padding: 64px 20px; } "
            "}"
        ),
    },
    # ── Additional snippets ──────────────────────────────────────────────────
    {
        "tags": ["ocean", "teal", "cyan", "navy", "blue", "water", "marine"],
        "description": "Ocean palette — deep teal/cyan on dark navy",
        "palette": "ocean",
        "css_snippet": (
            "/* Ocean palette: bg #0f172a | teal #0d9488 | cyan #06b6d4 | surface #1e3a4a */ "
            "body { background: #0f172a; color: #e2e8f0; } "
            "h1,h2,h3 { color: #fff; } p { color: #94a3b8; } "
            ".accent-bg { background: linear-gradient(135deg,#0d9488,#06b6d4); } "
            ".surface { background: #1e3a4a; border: 1px solid rgba(6,182,212,0.15); border-radius: 12px; } "
            ".btn-ocean { background: linear-gradient(135deg,#0d9488,#06b6d4); color:#fff; "
            "padding:12px 28px; border-radius:8px; font-weight:700; border:none; "
            "transition:transform .2s,box-shadow .2s; } "
            ".btn-ocean:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(6,182,212,.4); }"
        ),
    },
    {
        "tags": ["sunset", "coral", "orange", "warm", "fire", "red", "golden"],
        "description": "Sunset palette — coral/orange/golden warm gradients",
        "palette": "sunset",
        "css_snippet": (
            "/* Sunset palette: coral #f43f5e | orange #fb923c | gold #f59e0b */ "
            "body { background: #0c0a09; color: #fef3c7; } "
            "h1,h2,h3 { color: #fff; } p { color: #d6d3d1; } "
            ".accent-bg { background: linear-gradient(135deg,#f43f5e,#fb923c,#f59e0b); } "
            ".surface { background: #1c1917; border: 1px solid rgba(251,146,60,.15); border-radius:12px; } "
            ".btn-sunset { background: linear-gradient(90deg,#f43f5e,#fb923c); color:#fff; "
            "padding:12px 28px; border-radius:8px; font-weight:700; border:none; "
            "box-shadow:0 4px 20px rgba(244,63,94,.3); transition:transform .2s; } "
            ".btn-sunset:hover { transform:translateY(-2px); }"
        ),
    },
    {
        "tags": ["forest", "green", "nature", "organic", "earth", "botanical", "eco"],
        "description": "Forest palette — deep green/emerald on dark natural tones",
        "palette": "forest",
        "css_snippet": (
            "/* Forest: bg #052e16 | emerald #10b981 | cream #fefce8 */ "
            "body { background: #052e16; color: #d1fae5; } "
            "h1,h2,h3 { color: #ecfdf5; } p { color: #6ee7b7; } "
            ".accent-bg { background: linear-gradient(135deg,#14532d,#10b981); } "
            ".surface { background: #064e3b; border:1px solid rgba(16,185,129,.2); border-radius:12px; } "
            ".btn-forest { background: #10b981; color:#052e16; font-weight:700; "
            "padding:12px 28px; border-radius:8px; border:none; "
            "transition:background .2s,transform .2s; } "
            ".btn-forest:hover { background:#059669; transform:translateY(-2px); }"
        ),
    },
    {
        "tags": ["midnight", "neon", "electric", "glow", "black", "cyberpunk", "futuristic"],
        "description": "Midnight palette — pure black with electric blue/cyan neon",
        "palette": "midnight",
        "css_snippet": (
            "/* Midnight: bg #000 | electric #3b82f6 | neon cyan #22d3ee */ "
            "body { background: #000; color: #e2e8f0; } "
            "h1,h2,h3 { color: #fff; text-shadow: 0 0 20px rgba(59,130,246,.5); } "
            ".accent-bg { background: linear-gradient(135deg,#1d4ed8,#0e7490); } "
            ".surface { background: #0a0a0a; border:1px solid rgba(59,130,246,.25); "
            "border-radius:12px; box-shadow:0 0 20px rgba(59,130,246,.08); } "
            ".btn-neon { background: transparent; color:#22d3ee; font-weight:700; "
            "padding:12px 28px; border-radius:8px; border:2px solid #22d3ee; "
            "box-shadow:0 0 12px rgba(34,211,238,.3); transition:all .2s; } "
            ".btn-neon:hover { background:#22d3ee; color:#000; box-shadow:0 0 24px rgba(34,211,238,.6); }"
        ),
    },
    {
        "tags": ["rose", "pink", "feminine", "soft", "blush", "crimson", "romantic"],
        "description": "Rose palette — soft rose/blush with deep crimson accents",
        "palette": "rose",
        "css_snippet": (
            "/* Rose: bg #fff1f2 | crimson #be123c | rose #fda4af */ "
            "body { background: #fff1f2; color: #881337; } "
            "h1,h2,h3 { color: #4c0519; } p { color: #9f1239; } "
            ".accent-bg { background: linear-gradient(135deg,#be123c,#f43f5e); } "
            ".surface { background: #fff; border:1px solid #fecdd3; border-radius:12px; "
            "box-shadow:0 2px 12px rgba(190,18,60,.06); } "
            ".btn-rose { background: linear-gradient(135deg,#be123c,#f43f5e); color:#fff; "
            "padding:12px 28px; border-radius:9999px; font-weight:700; border:none; "
            "box-shadow:0 4px 16px rgba(190,18,60,.3); transition:transform .2s; } "
            ".btn-rose:hover { transform:translateY(-2px); }"
        ),
    },
    {
        "tags": ["bento", "asymmetric", "grid", "apple", "mixed", "mosaic", "cards"],
        "description": "Bento box grid layout — asymmetric mixed-size cards",
        "layout": "bento",
        "css_snippet": (
            ".bento-grid { display: grid; "
            "grid-template-columns: repeat(4, 1fr); grid-template-rows: auto; "
            "gap: 16px; max-width: 1100px; margin: 0 auto; padding: 48px 24px; } "
            ".bento-card { background: #1e293b; border-radius: 20px; padding: 32px; "
            "border: 1px solid rgba(255,255,255,0.06); transition: transform .2s; } "
            ".bento-card:hover { transform: scale(1.02); } "
            ".bento-card.wide { grid-column: span 2; } "
            ".bento-card.tall { grid-row: span 2; } "
            ".bento-card.featured { grid-column: span 2; grid-row: span 2; "
            "background: linear-gradient(135deg,#4f46e5,#7c3aed); }"
        ),
    },
    {
        "tags": ["split", "two-column", "side", "alternating", "zigzag", "image text"],
        "description": "Split layout — alternating 50/50 image+text sections",
        "layout": "split",
        "css_snippet": (
            ".split-section { display: flex; align-items: center; min-height: 60vh; "
            "padding: 80px 48px; gap: 64px; } "
            ".split-section:nth-child(even) { flex-direction: row-reverse; } "
            ".split-content { flex: 1; } "
            ".split-visual { flex: 1; border-radius: 20px; overflow: hidden; "
            "background: linear-gradient(135deg,#4f46e5,#7c3aed); "
            "min-height: 360px; display:flex; align-items:center; justify-content:center; } "
            "@media(max-width:768px) { .split-section { flex-direction: column !important; padding: 48px 24px; } }"
        ),
    },
    {
        "tags": ["fullscreen", "full-page", "scroll", "immersive", "snap", "100vh"],
        "description": "Fullscreen scroll-snap layout — each section 100vh",
        "layout": "fullscreen",
        "css_snippet": (
            "html { scroll-snap-type: y mandatory; overflow-y: scroll; } "
            ".fs-section { height: 100vh; scroll-snap-align: start; "
            "display: flex; align-items: center; justify-content: center; "
            "padding: 48px; position: relative; overflow: hidden; } "
            ".fs-content { max-width: 760px; text-align: center; z-index: 1; } "
            ".fs-section::before { content:''; position:absolute; inset:0; "
            "background: inherit; filter: brightness(0.4); z-index: 0; }"
        ),
    },
    {
        "tags": ["magazine", "editorial", "news", "blog", "masonry", "press"],
        "description": "Magazine/editorial layout with varied article card sizes",
        "layout": "magazine",
        "css_snippet": (
            ".magazine-grid { display: grid; "
            "grid-template-columns: 2fr 1fr 1fr; gap: 24px; "
            "max-width: 1200px; margin: 0 auto; padding: 48px 24px; } "
            ".mag-card { border-radius: 12px; overflow: hidden; "
            "background: #1e293b; border: 1px solid #334155; } "
            ".mag-card.hero-card { grid-row: span 2; } "
            ".mag-card-img { width:100%; aspect-ratio:16/9; object-fit:cover; "
            "background: linear-gradient(135deg,#4f46e5,#7c3aed); } "
            ".mag-card.hero-card .mag-card-img { aspect-ratio: 4/5; } "
            ".mag-card-body { padding: 20px; } "
            ".mag-tag { font-size:.7rem; font-weight:700; text-transform:uppercase; "
            "letter-spacing:.1em; color:#6366f1; margin-bottom:8px; }"
        ),
    },
]


# ── Retrieval ─────────────────────────────────────────────────────────────────
def retrieve_design_context(prompt: str, style_prefs: dict | None = None) -> list[str]:
    """
    Retrieves the most relevant design snippets for the given prompt.
    - Keyword-matches prompt against snippet tags (scored).
    - Always includes snippets that match the user's selected palette/layout preference.
    - Returns top 3-4 unique snippets.
    """
    prompt_words = set(re.findall(r"\w+", prompt.lower()))

    scored: list[tuple[int, dict]] = []
    forced: list[dict] = []

    selected_palette = (style_prefs or {}).get("palette", "")
    selected_layout  = (style_prefs or {}).get("layout", "")

    for snippet in DESIGN_STORE:
        # Force-include snippets matching selected palette or layout preference
        is_palette_match = snippet.get("palette") == selected_palette
        is_layout_match  = snippet.get("layout")  == selected_layout
        if is_palette_match or is_layout_match:
            forced.append(snippet)
            continue

        tag_words = set(
            word
            for tag in snippet["tags"]
            for word in re.findall(r"\w+", tag.lower())
        )
        score = len(prompt_words & tag_words)
        if score > 0:
            scored.append((score, snippet))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_scored = [s for _, s in scored]

    # Merge: forced first, then scored, deduplicated, max 4
    seen = set()
    combined: list[dict] = []
    for s in forced + top_scored:
        key = s["description"]
        if key not in seen:
            seen.add(key)
            combined.append(s)
        if len(combined) >= 4:
            break

    # Fallback: always include hero + mobile if nothing matched
    if not combined:
        combined = [DESIGN_STORE[0], DESIGN_STORE[9]]

    logger.info(
        "[RAG] palette_pref=%r layout_pref=%r prompt_words=%d → %d snippets: %s",
        selected_palette, selected_layout,
        len(prompt_words), len(combined),
        [s["description"][:55] for s in combined],
    )

    return [
        f"Snippet — {s['description']}:\n{s['css_snippet']}"
        for s in combined
    ]
