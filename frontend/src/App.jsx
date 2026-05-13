/** App.jsx — Root layout: 35/65 split pane */
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import { useWebsiteBuilder } from './hooks/useWebsiteBuilder'

export default function App() {
  const { messages, currentSite, isLoading, onGenerate } = useWebsiteBuilder()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Left — Chat (35%) */}
      <div className="w-[35%] min-w-[300px] max-w-[480px] flex-shrink-0 flex flex-col">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onGenerate={onGenerate}
        />
      </div>

      {/* Right — Preview (65%) */}
      <div className="flex-1 flex flex-col min-w-0">
        <PreviewPanel
          currentSite={currentSite}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
