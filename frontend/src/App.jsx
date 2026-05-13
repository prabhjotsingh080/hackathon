/** App.jsx — Root layout */
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import DebugPanel from './components/DebugPanel'
import { useWebsiteBuilder } from './hooks/useWebsiteBuilder'

export default function App() {
  const {
    messages, versions, activeVersionIndex, currentSite,
    isLoading, loadingMode, stylePreferences, attachedImage,
    changedSectionNames, debugInfo, isDebugMode,
    onGenerate, setActiveVersion, setStylePreferences,
    attachImage, clearAttachedImage,
  } = useWebsiteBuilder()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 font-sans">
      <div className="w-[35%] min-w-[300px] max-w-[480px] flex-shrink-0 flex flex-col">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          loadingMode={loadingMode}
          currentSite={currentSite}
          onGenerate={onGenerate}
          stylePreferences={stylePreferences}
          onStyleChange={setStylePreferences}
          attachedImage={attachedImage}
          onAttachImage={attachImage}
          onClearImage={clearAttachedImage}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <PreviewPanel
          currentSite={currentSite}
          isLoading={isLoading}
          loadingMode={loadingMode}
          versions={versions}
          activeVersionIndex={activeVersionIndex}
          setActiveVersion={setActiveVersion}
          changedSectionNames={changedSectionNames}
        />
      </div>

      {/* Debug panel — only visible when ?debug=true in URL, hidden in production */}
      <DebugPanel debugInfo={debugInfo} isDebugMode={isDebugMode} />
    </div>
  )
}
