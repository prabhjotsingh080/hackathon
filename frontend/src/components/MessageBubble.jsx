/** MessageBubble.jsx — Individual chat message component */

const AIAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1l2.39 7.347L22 11l-7.611 2.653L12 21l-2.389-7.347L2 11l7.611-2.653z" />
    </svg>
  </div>
)

const UserAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
    U
  </div>
)

export default function MessageBubble({ message }) {
  const isUser  = message.role === 'user'
  const isError = message.type === 'error'

  return (
    <div
      className={`flex items-end gap-2.5 animate-slide-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {isUser ? <UserAvatar /> : <AIAvatar />}

      <div
        className={`
          max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
          ${isUser
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm shadow-lg shadow-indigo-500/20'
            : isError
            ? 'bg-rose-950/60 border border-rose-700/60 text-rose-300 rounded-bl-sm'
            : 'bg-slate-700/70 text-slate-100 rounded-bl-sm'}
        `}
      >
        {isError && (
          <span className="inline-block mr-1.5 text-rose-400">⚠</span>
        )}
        {message.content}
      </div>
    </div>
  )
}
