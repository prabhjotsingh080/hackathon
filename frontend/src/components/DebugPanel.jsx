/**
 * DebugPanel.jsx — Collapsible debug overlay (bottom-left corner).
 * Only renders when ?debug=true is in the URL AND not in production.
 */
import { useState, useCallback } from 'react'

const IS_PRODUCTION = import.meta.env.MODE === 'production'

function CopyButton({ label, getText }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard not available */
    }
  }, [getText])

  return (
    <button
      onClick={handleCopy}
      style={{
        padding: '3px 10px',
        borderRadius: 5,
        background: copied ? '#22c55e' : '#334155',
        color: '#f1f5f9',
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        transition: 'background 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

function Row({ label, value, mono = false, dim = false }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 2, alignItems: 'flex-start' }}>
      <span style={{ color: '#94a3b8', fontSize: 10, minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: dim ? '#64748b' : '#e2e8f0',
          fontSize: 10,
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
        }}
      >
        {value ?? <em style={{ color: '#475569' }}>—</em>}
      </span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#6366f1',
          textTransform: 'uppercase',
          marginBottom: 4,
          borderBottom: '1px solid #1e293b',
          paddingBottom: 2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export default function DebugPanel({ debugInfo, isDebugMode }) {
  const [open, setOpen] = useState(false)

  // Hide entirely in production or when not in debug mode
  if (IS_PRODUCTION || !isDebugMode) return null

  const { lastRequest, lastResponse, assembledStats, iframeStats,
          parseErrors, fallbacks, lastSystemPrompt, lastAssembledHTML } = debugInfo

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 9999,
          padding: '5px 12px',
          borderRadius: 6,
          background: open ? '#4f46e5' : '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #334155',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'background 0.2s',
        }}
        title="Toggle debug panel (?debug=true)"
      >
        🛠 Debug
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 50,
            left: 16,
            zIndex: 9998,
            width: 400,
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            background: 'rgba(10,15,28,0.97)',
            border: '1px solid #1e293b',
            borderRadius: 10,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 12 }}>⚙ Debug Panel</span>
            <span style={{ color: '#475569', fontSize: 9 }}>?debug=true | dev only</span>
          </div>

          {/* Last Request */}
          <Section title="Last Request">
            <Row label="Endpoint"     value={lastRequest?.endpoint} mono />
            <Row label="Timestamp"    value={lastRequest?.timestamp} />
            <Row label="Prompt (80c)" value={lastRequest?.promptPreview} />
            <Row label="Has Image"    value={lastRequest?.hasImage ? 'yes' : 'no'} />
            <Row label="Style Prefs"  value={lastRequest ? JSON.stringify(lastRequest.stylePrefs) : null} mono />
          </Section>

          {/* Last Response */}
          <Section title="Last Response">
            <Row label="Title"          value={lastResponse?.title} />
            <Row label="Sections Got"   value={lastResponse?.sectionsReceived?.join(', ')} mono />
            <Row label="Changed Secs"   value={lastResponse?.sectionsReceived?.join(', ')} mono />
            <Row label="Unchanged Secs" value={lastResponse?.unchangedSections?.join(', ')} mono dim />
            <Row label="Fallback?"      value={lastResponse?.fallback ? '⚠ YES' : 'no'} />
          </Section>

          {/* Assembled HTML Stats */}
          <Section title="Assembled HTML Stats">
            <Row label="Total Chars"    value={assembledStats?.totalChars?.toLocaleString()} mono />
            <Row label="Section Count"  value={assembledStats?.sectionCount} mono />
            <Row label="CSS Chars"      value={assembledStats?.cssChars?.toLocaleString()} mono />
            <Row label="JS Chars"       value={assembledStats?.jsChars?.toLocaleString()} mono />
          </Section>

          {/* Iframe Status */}
          <Section title="Iframe Status">
            <Row label="srcdoc Length"  value={iframeStats?.srcdocLength?.toLocaleString() ?? assembledStats?.totalChars?.toLocaleString()} mono />
            <Row label="Last Updated"   value={iframeStats?.lastUpdated ?? lastRequest?.timestamp} />
          </Section>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <Section title={`Parse Errors (${parseErrors.length})`}>
              {parseErrors.slice(-3).map((e, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <Row label={e.timestamp} value={e.message} />
                </div>
              ))}
            </Section>
          )}

          {/* Fallbacks */}
          {fallbacks.length > 0 && (
            <Section title={`Fallbacks (${fallbacks.length})`}>
              {fallbacks.slice(-3).map((f, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <Row label={f.timestamp} value={f.prompt?.slice(0, 60)} />
                </div>
              ))}
            </Section>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <CopyButton
              label="Copy Assembled HTML"
              getText={() => lastAssembledHTML ?? ''}
            />
            <CopyButton
              label="Copy System Prompt"
              getText={() => lastSystemPrompt ?? '(request with ?debug=true to capture)'}
            />
          </div>

          {!lastSystemPrompt && (
            <p style={{ color: '#475569', fontSize: 9, marginTop: 6 }}>
              System prompt appears after first request with ?debug=true in URL.
            </p>
          )}
        </div>
      )}
    </>
  )
}
