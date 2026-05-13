/** PreviewPanel.jsx — iframe preview with section flash on refinement */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { combineHTML } from '../utils/combineHTML'
import VersionHistory from './VersionHistory'

function PlaceholderIllustration() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 select-none px-12">
      <svg viewBox="0 0 240 180" className="w-56 opacity-80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="220" height="160" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
        <rect x="10" y="10" width="220" height="28" rx="10" fill="#273449"/>
        <rect x="10" y="28" width="220" height="10" fill="#273449"/>
        <circle cx="28" cy="24" r="4.5" fill="#f87171"/><circle cx="43" cy="24" r="4.5" fill="#fbbf24"/><circle cx="58" cy="24" r="4.5" fill="#34d399"/>
        <rect x="70" y="17" width="120" height="14" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
        <rect x="24" y="48" width="192" height="16" rx="4" fill="#334155" opacity="0.6"/>
        <rect x="24" y="72" width="130" height="8" rx="4" fill="#334155" opacity="0.4"/>
        <rect x="24" y="86" width="100" height="8" rx="4" fill="#334155" opacity="0.3"/>
        <rect x="24" y="106" width="60" height="22" rx="6" fill="#6366f1" opacity="0.7"/>
        <path d="M210 55l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#818cf8" opacity="0.8"/>
      </svg>
      <div className="text-center">
        <p className="text-slate-400 font-semibold text-sm">Your site will appear here</p>
        <p className="text-slate-600 text-xs mt-1.5 leading-relaxed max-w-xs">
          Type a description and hit <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono mx-0.5">Enter</kbd>
        </p>
      </div>
    </div>
  )
}

function PreviewToolbar({ site, srcDoc, isLoading, loadingMode, changedSectionNames, versionCount, onToggleHistory }) {
  const handleOpenTab = () => {
    const blob = new Blob([srcDoc], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
  }
  const isRefine = loadingMode === 'refine'
  const isVision = loadingMode === 'vision'

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
      <div className="flex gap-1.5 mr-1">
        <span className="w-3 h-3 rounded-full bg-red-400"/><span className="w-3 h-3 rounded-full bg-yellow-400"/><span className="w-3 h-3 rounded-full bg-green-400"/>
      </div>
      <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 min-w-0">
        {isLoading
          ? <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin flex-shrink-0"/>
          : <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z"/></svg>
        }
        <span className="text-xs text-gray-500 truncate font-medium">
          {isLoading
            ? isVision ? 'Analysing sketch…'
              : isRefine ? `Refining ${changedSectionNames.length ? changedSectionNames.join(', ') : 'sections'}…`
              : 'Generating…'
            : site ? site.title : 'No site generated yet'}
        </span>
      </div>

      {versionCount > 0 && (
        <button onClick={onToggleHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex-shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="12 7 12 12 15 15"/>
          </svg>
          History
          <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{versionCount}</span>
        </button>
      )}

      {site && (
        <button onClick={handleOpenTab}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex-shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open
        </button>
      )}
    </div>
  )
}

function LoadingOverlay({ loadingMode }) {
  const isRefine = loadingMode === 'refine'
  const isVision = loadingMode === 'vision'
  const label    = isVision ? 'Analysing your sketch…' : isRefine ? 'Refining sections…' : 'Generating your website…'
  const sublabel = isVision ? 'Vision model analysing layout + content'
    : isRefine ? 'Only changed sections will update'
    : 'This usually takes 3–8 seconds'
  const color = isVision ? 'from-pink-500 to-violet-600' : isRefine ? 'from-violet-600 to-indigo-700' : 'from-indigo-500 to-violet-600'
  return (
    <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-fade-in z-10">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100"/>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"/>
        <div className={`absolute inset-2 rounded-full flex items-center justify-center bg-gradient-to-br ${color}`}>
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z"/></svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-slate-700 font-semibold text-sm">{label}</p>
        <p className="text-slate-400 text-xs mt-1">{sublabel}</p>
      </div>
    </div>
  )
}

/** Inject a temporary CSS flash into the iframe for changed sections. */
function flashSections(iframe, sectionNames) {
  if (!iframe || !sectionNames.length) return
  try {
    const doc = iframe.contentDocument
    if (!doc) return
    const existing = doc.getElementById('__section-flash__')
    if (existing) existing.remove()
    const style = doc.createElement('style')
    style.id = '__section-flash__'
    // Target both the section's own id AND the scoping wrapper div
    style.textContent = sectionNames
      .map((n) => [
        `#${n}{outline:3px solid #fbbf24!important;outline-offset:2px!important;transition:outline 0.3s}`,
        `#section-${n}{outline:3px solid #fbbf24!important;outline-offset:2px!important;transition:outline 0.3s}`,
      ].join('\n'))
      .join('\n')
    doc.head.appendChild(style)
    setTimeout(() => {
      try { doc.getElementById('__section-flash__')?.remove() } catch {}
    }, 800)
  } catch {}
}

// ── Sandbox attribute validation ──────────────────────────────────────────────
const REQUIRED_SANDBOX = ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-modals']
const SANDBOX_VALUE    = REQUIRED_SANDBOX.join(' ')

function validateSandbox(sandbox) {
  const parts = sandbox.split(' ')
  REQUIRED_SANDBOX.forEach((attr) => {
    if (!parts.includes(attr)) {
      console.warn(`[IFRAME_SANDBOX] Missing "${attr}" — Google Fonts or JS may fail. Current: "${sandbox}"`)
    }
  })
}

export default function PreviewPanel({
  currentSite, isLoading, loadingMode,
  versions, activeVersionIndex, setActiveVersion,
  changedSectionNames,
}) {
  const [showHistory, setShowHistory] = useState(false)
  const iframeRef = useRef(null)

  const srcDoc = useMemo(() => {
    if (!currentSite) return ''
    const doc = combineHTML(currentSite)
    console.log('[IFRAME_SRCDOC_LENGTH]', doc.length, 'chars, title:', currentSite.title)
    return doc
  }, [currentSite])

  // Validate sandbox on mount
  useEffect(() => {
    validateSandbox(SANDBOX_VALUE)
  }, [])

  const handleIframeLoad = useCallback(() => {
    if (changedSectionNames?.length) {
      flashSections(iframeRef.current, changedSectionNames)
    }
    console.log('[IFRAME_LOAD] srcdoc length:', srcDoc.length,
      '| sections flashed:', changedSectionNames)
  }, [changedSectionNames, srcDoc])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PreviewToolbar
        site={currentSite} srcDoc={srcDoc}
        isLoading={isLoading} loadingMode={loadingMode}
        changedSectionNames={changedSectionNames}
        versionCount={versions.length}
        onToggleHistory={() => setShowHistory((v) => !v)}
      />
      <div className="flex-1 relative overflow-hidden min-h-0">
        {currentSite ? (
          <iframe
            ref={iframeRef}
            key={srcDoc}
            srcDoc={srcDoc}
            title={currentSite.title}
            sandbox={SANDBOX_VALUE}
            className="w-full h-full animate-fade-in"
            onLoad={handleIframeLoad}
          />
        ) : <PlaceholderIllustration />}

        {isLoading && <LoadingOverlay loadingMode={loadingMode} />}

        {showHistory && (
          <VersionHistory
            versions={versions}
            activeVersionIndex={activeVersionIndex}
            onSetActive={(idx) => { setActiveVersion(idx) }}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  )
}
