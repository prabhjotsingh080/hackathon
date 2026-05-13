/** ChatPanel.jsx — Left panel: message history + image upload + style controls */
import { useRef, useEffect, useState, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import StyleControls from './StyleControls'

/* ── Icons ─────────────────────────────────────────────────────── */
const SparkleIcon = () => (
  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z" />
  </svg>
)

const SendIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const PaperclipIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

/* ── Typing / refining indicator ────────────────────────────────── */
function TypingIndicator({ loadingMode }) {
  const isVision = loadingMode?.startsWith('vision')
  const isRefine = loadingMode === 'refine' || loadingMode === 'vision-refine'
  let label = 'Thinking…'
  if (isVision) label = 'Analysing your sketch…'
  else if (isRefine) label = 'Refining…'

  return (
    <div className="flex items-end gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
        ${isVision ? 'bg-gradient-to-br from-pink-500 to-violet-600'
          : isRefine ? 'bg-gradient-to-br from-violet-600 to-indigo-700'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
        <SparkleIcon />
      </div>
      <div className={`rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2
        ${isVision ? 'bg-pink-900/30 border border-pink-700/40'
          : isRefine ? 'bg-violet-900/30 border border-violet-700/40'
          : 'bg-slate-700/70'}`}>
        <span className={`w-3.5 h-3.5 border-2 rounded-full animate-spin
          ${isVision ? 'border-pink-400/40 border-t-pink-400'
            : isRefine ? 'border-violet-400/40 border-t-violet-400'
            : 'border-indigo-400/40 border-t-indigo-400'}`} />
        <span className={`text-xs font-medium
          ${isVision ? 'text-pink-300' : isRefine ? 'text-violet-300' : 'text-indigo-300'}`}>
          {label}
        </span>
      </div>
    </div>
  )
}

/* ── Example prompts ─────────────────────────────────────────────── */
const EXAMPLES = [
  'a landing page for a chatbot SaaS',
  'a portfolio site for a UI/UX designer',
  'a product page for wireless earbuds',
]

function EmptyState({ onExample }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
        <SparkleIcon />
      </div>
      <div>
        <p className="text-slate-200 font-semibold text-sm">What do you want to build?</p>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed">
          Describe a website or upload a sketch.<br />The AI generates live HTML/CSS/JS in seconds.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => onExample(ex)}
            className="text-left px-3.5 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 hover:bg-slate-800 transition-all duration-200 leading-snug">
            <span className="text-slate-600 mr-1">"</span>{ex}<span className="text-slate-600 ml-0.5">"</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Image thumbnail strip ───────────────────────────────────────── */
function AttachedImagePreview({ image, onClear }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border-t border-slate-700/50">
      <div className="relative flex-shrink-0">
        <img src={image.previewUrl} alt="Attached" className="w-10 h-10 rounded-lg object-cover border border-indigo-400/40" />
        <button
          onClick={onClear}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-600 hover:bg-rose-500 border border-slate-500 flex items-center justify-center text-white transition-colors"
        >
          <XIcon />
        </button>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-300 font-medium truncate">{image.file.name}</p>
        <p className="text-[10px] text-indigo-400">Sketch attached — vision mode active</p>
      </div>
    </div>
  )
}

/* ── Copy HTML button ────────────────────────────────────────────── */
function CopyHTMLButton({ currentSite }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!currentSite) return
    try {
      // Assemble full HTML doc inline (avoids importing assembleSections here)
      const { assembleSections } = await import('../utils/combineHTML')
      const html = assembleSections(currentSite.sections, currentSite.title)
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [currentSite])

  if (!currentSite) return null

  return (
    <button
      onClick={handleCopy}
      title="Copy full HTML to clipboard"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 flex-shrink-0
        ${copied
          ? 'bg-emerald-900/40 border-emerald-600/50 text-emerald-400'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
    >
      <CopyIcon />
      {copied ? 'Copied!' : 'Copy HTML'}
    </button>
  )
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function ChatPanel({
  messages, isLoading, loadingMode, currentSite,
  onGenerate, stylePreferences, onStyleChange,
  attachedImage, onAttachImage, onClearImage,
}) {
  const [input, setInput]  = useState('')
  const bottomRef          = useRef(null)
  const textareaRef        = useRef(null)
  const fileInputRef       = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if ((!trimmed && !attachedImage) || isLoading) return
    onGenerate(trimmed || 'Generate a website based on my sketch.')
    setInput('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter → submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }
    // Plain Enter (no shift) → submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onAttachImage(file)
    e.target.value = ''
  }

  const hintText = attachedImage
    ? '↵  Send · Ctrl+Enter also works'
    : currentSite
    ? '↵  Refine · Ctrl+Enter · Shift+Enter for new line'
    : '↵  Generate · Ctrl+Enter · Shift+Enter for new line'

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700/50">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse-glow">
          <SparkleIcon />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-white leading-none">GenAI Website Builder</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Groq · llama-3.3-70b-versatile</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {/* Copy HTML — shown when a site exists */}
          <CopyHTMLButton currentSite={currentSite} />
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-400">Online</span>
        </div>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 min-h-0">
        {messages.length === 0
          ? <EmptyState onExample={(t) => { setInput(t); textareaRef.current?.focus() }} />
          : messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        }
        {isLoading && <TypingIndicator loadingMode={loadingMode} />}
        <div ref={bottomRef} />
      </div>

      {/* Style controls */}
      <StyleControls prefs={stylePreferences} onChange={onStyleChange} />

      {/* Attached image strip */}
      {attachedImage && (
        <AttachedImagePreview image={attachedImage} onClear={onClearImage} />
      )}

      {/* Input bar */}
      <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
        <div className={`flex items-end gap-2 bg-slate-800 border rounded-2xl px-3 py-2 transition-all duration-200
          ${attachedImage
            ? 'border-pink-500/50 ring-1 ring-pink-500/20'
            : 'border-slate-700/80 focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/20'}`}>

          {/* Paperclip / image upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach a sketch or screenshot"
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 disabled:opacity-30
              ${attachedImage
                ? 'text-pink-400 bg-pink-500/10 hover:bg-pink-500/20'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
          >
            <PaperclipIcon />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedImage ? 'Describe changes or just hit Enter…' : 'Describe your website…'}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none py-1.5 max-h-36 disabled:opacity-50 leading-relaxed"
          />

          <button
            onClick={handleSubmit}
            disabled={(!input.trim() && !attachedImage) || isLoading}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md
              disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
              transition-all duration-200 hover:scale-105 active:scale-95
              ${attachedImage
                ? 'bg-gradient-to-br from-pink-500 to-violet-600 shadow-pink-500/25 hover:from-pink-400 hover:to-violet-500'
                : loadingMode === 'refine'
                ? 'bg-gradient-to-br from-violet-500 to-indigo-700 shadow-violet-500/25 hover:from-violet-400 hover:to-indigo-600'
                : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-500'}`}
            aria-label="Generate website"
          >
            {isLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <SendIcon />}
          </button>
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-2">{hintText}</p>
      </div>
    </div>
  )
}
