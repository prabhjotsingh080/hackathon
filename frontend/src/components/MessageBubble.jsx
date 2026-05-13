/** MessageBubble.jsx — Chat message with optional metadata footer */

const AIAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z"/>
    </svg>
  </div>
)

const UserAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">U</div>
)

function fmt(ms) {
  return ms ? `${(ms / 1000).toFixed(1)}s` : null
}

function MetaFooter({ metadata }) {
  if (!metadata) return null
  const { type, time_ms, tokens, sections_count, changed, unchanged, fallback } = metadata

  if (type === 'generate' || type === 'vision') {
    return (
      <p className="text-[10px] text-slate-500 mt-1 pl-1">
        {type === 'vision' ? '📷 Vision' : '✦ Generated'} {sections_count} section{sections_count !== 1 ? 's' : ''}
        {time_ms ? ` · ${fmt(time_ms)}` : ''}
        {tokens  ? ` · ~${tokens} tokens` : ''}
      </p>
    )
  }

  if (type === 'refine') {
    return (
      <p className="text-[10px] text-slate-500 mt-1 pl-1">
        {fallback ? '⚠ Fallback regen' : '✦ Refined'}
        {changed?.length  ? ` · Updated: ${changed.join(', ')}` : ''}
        {unchanged?.length ? ` · Kept: ${unchanged.join(', ')}` : ''}
        {time_ms ? ` · ${fmt(time_ms)}` : ''}
        {tokens  ? ` · ~${tokens} tokens` : ''}
      </p>
    )
  }
  return null
}

export default function MessageBubble({ message }) {
  const isUser  = message.role === 'user'
  const isError = message.type === 'error'

  return (
    <div className={`flex items-end gap-2.5 animate-slide-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {isUser ? <UserAvatar /> : <AIAvatar />}

      <div className="max-w-[80%] flex flex-col gap-1">
        {/* Image thumbnail */}
        {isUser && message.imageSrc && (
          <div className="flex justify-end">
            <div className="relative rounded-xl overflow-hidden border-2 border-indigo-400/40 shadow-lg">
              <img src={message.imageSrc} alt="Uploaded sketch" className="max-w-[180px] max-h-[140px] object-cover"/>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                <span className="text-[10px] text-white/80 font-medium">📎 Sketch attached</span>
              </div>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
          ${isUser
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm shadow-lg shadow-indigo-500/20'
            : isError
            ? 'bg-rose-950/60 border border-rose-700/60 text-rose-300 rounded-bl-sm'
            : 'bg-slate-700/70 text-slate-100 rounded-bl-sm'}`}>
          {isError && <span className="inline-block mr-1.5 text-rose-400">⚠</span>}
          {message.content}
        </div>

        {/* Metadata footer — assistant messages only */}
        {!isUser && <MetaFooter metadata={message.metadata} />}
      </div>
    </div>
  )
}
