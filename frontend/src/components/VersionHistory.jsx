/** VersionHistory.jsx — Slide-in drawer listing every generated version */
import { useEffect } from 'react'

const fmt = (date) =>
  new Intl.DateTimeFormat('en', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date)

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const HistoryIcon = () => (
  <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
)

function VersionCard({ version, index, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-all duration-150 group
        border-l-2 ${isActive ? 'border-l-indigo-500 bg-indigo-50' : 'border-l-transparent hover:bg-gray-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Badge + active label */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
              ${isActive ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'}`}>
              v{index + 1}
            </span>
            {isActive && (
              <span className="text-[10px] text-indigo-500 font-semibold">● Active</span>
            )}
          </div>
          {/* Site title */}
          <p className="text-xs font-semibold text-gray-700 truncate">{version.site.title}</p>
          {/* Prompt snippet */}
          <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={version.prompt}>
            "{version.prompt}"
          </p>
        </div>
        {/* Timestamp */}
        <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 tabular-nums">
          {fmt(version.timestamp)}
        </span>
      </div>
    </button>
  )
}

export default function VersionHistory({ versions, activeVersionIndex, onSetActive, onClose }) {
  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 z-10 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-72 bg-white z-20 flex flex-col shadow-2xl border-l border-gray-200 animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <HistoryIcon />
            <h2 className="text-sm font-semibold text-gray-800">Version History</h2>
            <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
              {versions.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Version list — newest first */}
        <div className="flex-1 overflow-y-auto">
          {versions.length === 0 ? (
            <p className="text-center text-xs text-gray-400 mt-10 px-6">
              No versions yet. Generate a site to start tracking history.
            </p>
          ) : (
            [...versions].reverse().map((v, ri) => {
              const idx = versions.length - 1 - ri
              return (
                <VersionCard
                  key={v.id}
                  version={v}
                  index={idx}
                  isActive={idx === activeVersionIndex}
                  onClick={() => { onSetActive(idx); onClose() }}
                />
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Click any version to restore it as the active preview and refinement base.
          </p>
        </div>
      </div>
    </>
  )
}
