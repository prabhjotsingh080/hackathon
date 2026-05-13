/**
 * StyleControls.jsx — Collapsible palette / font / layout picker.
 * Each font option label is rendered in its own typeface.
 * Selected values are passed as style_preferences on every generate/refine call.
 */
import { useState } from 'react'

/* ── Option data ─────────────────────────────────────────────────── */
const PALETTES = [
  { id: 'minimal',   label: 'Minimal',   colors: ['#ffffff', '#f5f5f5', '#111111'] },
  { id: 'dark',      label: 'Dark',      colors: ['#0f172a', '#1e293b', '#818cf8'] },
  { id: 'vibrant',   label: 'Vibrant',   colors: ['#f97316', '#ec4899', '#8b5cf6'] },
  { id: 'earthy',    label: 'Earthy',    colors: ['#78350f', '#d97706', '#fde68a'] },
  { id: 'corporate', label: 'Corporate', colors: ['#1d4ed8', '#3b82f6', '#eff6ff'] },
  { id: 'ocean',     label: 'Ocean',     colors: ['#0f172a', '#0d9488', '#06b6d4'] },
  { id: 'sunset',    label: 'Sunset',    colors: ['#0c0a09', '#f43f5e', '#fb923c'] },
  { id: 'forest',    label: 'Forest',    colors: ['#052e16', '#10b981', '#fefce8'] },
  { id: 'midnight',  label: 'Midnight',  colors: ['#000000', '#3b82f6', '#22d3ee'] },
  { id: 'rose',      label: 'Rose',      colors: ['#fff1f2', '#be123c', '#fda4af'] },
]

// id must exactly match the Google Fonts family name used in index.html
const FONTS = [
  { id: 'Inter',            label: 'Inter' },
  { id: 'Outfit',           label: 'Outfit' },
  { id: 'DM Sans',          label: 'DM Sans' },
  { id: 'Playfair Display', label: 'Playfair' },
  { id: 'Space Mono',       label: 'Mono' },
  { id: 'Poppins',          label: 'Poppins' },
  { id: 'Merriweather',     label: 'Merriweather' },
  { id: 'Nunito',           label: 'Nunito' },
]

const LAYOUTS = [
  { id: 'hero',       label: 'Hero',        icon: '⬛' },
  { id: 'grid',       label: 'Card Grid',   icon: '▦' },
  { id: 'sidebar',    label: 'Sidebar',     icon: '▤' },
  { id: 'magazine',   label: 'Magazine',    icon: '▥' },
  { id: 'single',     label: 'Single Col',  icon: '▬' },
  { id: 'bento',      label: 'Bento',       icon: '⊞' },
  { id: 'split',      label: 'Split',       icon: '◫' },
  { id: 'fullscreen', label: 'Fullscreen',  icon: '⛶' },
]

/* ── Sub-components ──────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
      {children}
    </p>
  )
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function StyleControls({ prefs, onChange }) {
  const [open, setOpen] = useState(false)
  const set = (key, val) => onChange({ ...prefs, [key]: val })

  return (
    <div className="border-t border-slate-700/50">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93A10 10 0 0 0 12 2a10 10 0 0 0-7.07 2.93" />
            <path d="M4.93 19.07A10 10 0 0 0 12 22a10 10 0 0 0 7.07-2.93" />
          </svg>
          <span className="font-medium">Style Preferences</span>
          {(prefs.palette !== 'minimal' || prefs.font !== 'Inter' || prefs.layout !== 'hero') && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in bg-slate-800/30">

          {/* Palette */}
          <div>
            <SectionLabel>Color Palette</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set('palette', p.id)}
                  title={p.label}
                  className={`flex flex-col items-center gap-1 group transition-all duration-150 ${
                    prefs.palette === p.id ? 'scale-105' : 'opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className={`flex rounded-md overflow-hidden border-2 transition-colors ${
                    prefs.palette === p.id ? 'border-indigo-400' : 'border-transparent'
                  }`}>
                    {p.colors.map((c) => (
                      <span key={c} className="w-5 h-6 block" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-[9px] text-slate-400 group-hover:text-slate-300">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font — each label rendered in its own typeface */}
          <div>
            <SectionLabel>Font</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => set('font', f.id)}
                  style={{ fontFamily: `'${f.id}', sans-serif` }}
                  className={`px-2.5 py-1 rounded-lg text-[12px] border transition-all duration-150 ${
                    prefs.font === f.id
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400 hover:text-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div>
            <SectionLabel>Layout</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => set('layout', l.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-all duration-150 ${
                    prefs.layout === l.id
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{l.icon}</span>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
