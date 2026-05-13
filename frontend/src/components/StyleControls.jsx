/** StyleControls.jsx — Palette / font picker (Tier 3 prep, minimal now) */

const palettes = [
  { name: 'Indigo', value: 'indigo', colors: ['#6366f1', '#8b5cf6', '#e0e7ff'] },
  { name: 'Rose',   value: 'rose',   colors: ['#f43f5e', '#fb7185', '#ffe4e6'] },
  { name: 'Emerald',value: 'emerald',colors: ['#10b981', '#34d399', '#d1fae5'] },
  { name: 'Amber',  value: 'amber',  colors: ['#f59e0b', '#fbbf24', '#fef3c7'] },
]

const fonts = ['Inter', 'Roboto', 'Playfair Display', 'Space Grotesk']

export default function StyleControls({ disabled = false }) {
  return (
    <div className="px-4 py-3 border-t border-slate-700/50">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
        Style Presets <span className="text-slate-600 normal-case tracking-normal font-normal">(coming soon)</span>
      </p>

      {/* Palette swatches */}
      <div className="flex gap-2 mb-2">
        {palettes.map((p) => (
          <button
            key={p.value}
            disabled={disabled}
            title={p.name}
            className="flex gap-0.5 rounded-md overflow-hidden opacity-40 cursor-not-allowed hover:opacity-50 transition-opacity"
          >
            {p.colors.map((c) => (
              <span key={c} className="w-3.5 h-5 block" style={{ backgroundColor: c }} />
            ))}
          </button>
        ))}
      </div>

      {/* Font selector */}
      <select
        disabled
        className="w-full bg-slate-800 border border-slate-700 text-slate-500 text-xs rounded-lg px-2.5 py-1.5 cursor-not-allowed opacity-40"
      >
        {fonts.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
    </div>
  )
}
