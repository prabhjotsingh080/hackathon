/** ChatPanel.jsx — Left panel: message history + pinned input */
import { useRef, useEffect, useState } from 'react'
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
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

/* ── Typing indicator ───────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
        <SparkleIcon />
      </div>
      <div className="bg-slate-700/70 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Example prompts ────────────────────────────────────────────── */
const EXAMPLES = [
  'a landing page for a chatbot SaaS',
  'a portfolio site for a UI/UX designer',
  'a product page for wireless earbuds',
]

/* ── Empty state ────────────────────────────────────────────────── */
function EmptyState({ onExample }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center shadow-inner">
        <svg className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z" />
        </svg>
      </div>
      <div>
        <p className="text-slate-200 font-semibold text-sm">What do you want to build?</p>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed">
          Describe any website — the AI will generate<br />live HTML, CSS &amp; JS in seconds.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onExample(ex)}
            className="text-left px-3.5 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 hover:bg-slate-800 transition-all duration-200 leading-snug"
          >
            <span className="text-slate-600 mr-1.5">"</span>
            {ex}
            <span className="text-slate-600 ml-0.5">"</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────── */
export default function ChatPanel({ messages, isLoading, onGenerate }) {
  const [input, setInput]     = useState('')
  const bottomRef             = useRef(null)
  const textareaRef           = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onGenerate(trimmed)
    setInput('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleExample = (text) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700/50">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse-glow">
          <SparkleIcon />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-white leading-none">GenAI Website Builder</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Groq · llama-3.3-70b-versatile</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-400">Online</span>
        </div>
      </div>

      {/* ── Message history ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 min-h-0">
        {messages.length === 0
          ? <EmptyState onExample={handleExample} />
          : messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        }
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Style controls (Tier 3 placeholder) ──────────────── */}
      <StyleControls disabled />

      {/* ── Input bar ────────────────────────────────────────── */}
      <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
        <div className="flex items-end gap-2 bg-slate-800 border border-slate-700/80 rounded-2xl px-3 py-2 focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all duration-200">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your website…"
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none py-1.5 max-h-36 disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Generate website"
          >
            {isLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <SendIcon />
            }
          </button>
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-2">
          ↵ Enter to generate · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
