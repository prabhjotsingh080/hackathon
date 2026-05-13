/** PreviewPanel.jsx — Right panel: iframe live preview */
import { useMemo } from 'react'
import { combineHTML } from '../utils/combineHTML'

/* ── Placeholder SVG illustration ──────────────────────────────── */
function PlaceholderIllustration() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 select-none px-12">
      <svg
        viewBox="0 0 240 180"
        className="w-56 opacity-80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Browser chrome */}
        <rect x="10" y="10" width="220" height="160" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
        <rect x="10" y="10" width="220" height="28" rx="10" fill="#273449" />
        <rect x="10" y="28" width="220" height="10" fill="#273449" />
        {/* Traffic lights */}
        <circle cx="28" cy="24" r="4.5" fill="#f87171" />
        <circle cx="43" cy="24" r="4.5" fill="#fbbf24" />
        <circle cx="58" cy="24" r="4.5" fill="#34d399" />
        {/* URL bar */}
        <rect x="70" y="17" width="120" height="14" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        <text x="130" y="27.5" textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">localhost:8000/generate</text>
        {/* Page skeleton */}
        <rect x="24" y="48" width="192" height="16" rx="4" fill="#334155" opacity="0.6" />
        <rect x="24" y="72" width="130" height="8" rx="4" fill="#334155" opacity="0.4" />
        <rect x="24" y="86" width="100" height="8" rx="4" fill="#334155" opacity="0.3" />
        <rect x="24" y="106" width="60" height="22" rx="6" fill="#6366f1" opacity="0.7" />
        <rect x="24" y="138" width="192" height="8" rx="4" fill="#334155" opacity="0.25" />
        <rect x="24" y="151" width="140" height="8" rx="4" fill="#334155" opacity="0.2" />
        {/* Sparkle */}
        <path d="M210 55 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" fill="#818cf8" opacity="0.8" />
        <path d="M194 72 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5z" fill="#a78bfa" opacity="0.6" />
      </svg>

      <div className="text-center">
        <p className="text-slate-400 font-semibold text-sm">Your site will appear here</p>
        <p className="text-slate-600 text-xs mt-1.5 leading-relaxed max-w-xs">
          Type a description in the chat panel and hit<br />
          <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono mx-0.5">Enter</kbd>
          to generate a live preview instantly.
        </p>
      </div>
    </div>
  )
}

/* ── Toolbar above the iframe ───────────────────────────────────── */
function PreviewToolbar({ site, srcDoc, isLoading }) {
  const handleOpenTab = () => {
    const blob = new Blob([srcDoc], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
      {/* Traffic-light dots */}
      <div className="flex gap-1.5">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
      </div>

      {/* Title pill */}
      <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 min-w-0">
        {isLoading ? (
          <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" />
        ) : (
          <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z" />
          </svg>
        )}
        <span className="text-xs text-gray-500 truncate font-medium">
          {site ? site.title : 'No site generated yet'}
        </span>
      </div>

      {/* Open in tab */}
      {site && (
        <button
          onClick={handleOpenTab}
          title="Open in new tab"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors duration-150 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open
        </button>
      )}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────── */
export default function PreviewPanel({ currentSite, isLoading }) {
  const srcDoc = useMemo(
    () => (currentSite ? combineHTML(currentSite) : ''),
    [currentSite],
  )

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PreviewToolbar site={currentSite} srcDoc={srcDoc} isLoading={isLoading} />

      <div className="flex-1 relative overflow-hidden min-h-0">
        {currentSite ? (
          <iframe
            key={srcDoc}             /* remount on new content */
            srcDoc={srcDoc}
            title={currentSite.title}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="w-full h-full animate-fade-in"
          />
        ) : (
          <PlaceholderIllustration />
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-semibold text-sm">Generating your website…</p>
              <p className="text-slate-400 text-xs mt-1">This usually takes 3–8 seconds</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
