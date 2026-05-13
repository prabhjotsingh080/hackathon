/**
 * useWebsiteBuilder.js — Patch-based architecture.
 * - First prompt → POST /generate → stores full WebsiteOutput with sections[]
 * - Follow-up prompts → POST /refine → merges changed_sections into currentSections
 * - Image uploads → POST /generate-vision → same as /generate
 * - Versions store the assembled site after every change
 * - Style preferences are persisted in localStorage across sessions
 */
import { useState, useCallback } from 'react'
import { assembleSections } from '../utils/combineHTML'

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000'

const PREFS_STORAGE_KEY = 'genai_style_prefs'
const DEFAULT_PREFS = { palette: 'minimal', font: 'Inter', layout: 'hero' }

/** Load persisted preferences from localStorage, falling back to defaults */
function loadPersistedPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Validate shape — only keep known keys
      return {
        palette: typeof parsed.palette === 'string' ? parsed.palette : DEFAULT_PREFS.palette,
        font:    typeof parsed.font    === 'string' ? parsed.font    : DEFAULT_PREFS.font,
        layout:  typeof parsed.layout  === 'string' ? parsed.layout  : DEFAULT_PREFS.layout,
      }
    }
  } catch { /* corrupted storage — ignore */ }
  return DEFAULT_PREFS
}

/** Check if ?debug=true is in the URL */
const IS_DEBUG = new URLSearchParams(window.location.search).get('debug') === 'true'

let _id = 0
const uid = () => ++_id

const makeMessage = (role, content, type = 'text', imageSrc = null, metadata = null) => ({
  id: uid(), role, content, type, imageSrc, metadata, timestamp: new Date(),
})

const makeVersion = (site, prompt) => ({
  id: uid(), site, prompt, timestamp: new Date(),
})

/**
 * Merge RefinementOutput into the existing sections array.
 * Order is driven by currentSections — we never reorder.
 * Brand-new sections from the LLM are appended at the end.
 */
function mergeSections(currentSections, refinement) {
  const changedMap = Object.fromEntries(
    refinement.changed_sections.map((s) => [s.section, s])
  )
  const unchangedSet = new Set(refinement.unchanged_section_names)

  console.log('[MERGE_BEFORE]', currentSections.map((s) => s.section))

  // Start from CURRENT order as source of truth
  const merged = currentSections.map((s) => {
    if (changedMap[s.section]) return changedMap[s.section]   // replace changed
    if (unchangedSet.has(s.section)) return s                  // keep unchanged
    return s                                                    // keep anything else as-is
  })

  // Append brand-new sections that weren't in currentSections at all
  refinement.changed_sections.forEach((s) => {
    if (!merged.find((m) => m.section === s.section)) merged.push(s)
  })

  console.log('[MERGE_AFTER]', merged.map((s) => s.section))
  console.log('[MERGE_ORDER_PRESERVED] Final section order:', merged.map((s) => s.section))
  return merged
}

export function useWebsiteBuilder() {
  const [messages,            setMessages]           = useState([])
  const [versions,            setVersions]           = useState([])
  const [activeVersionIndex,  setActiveVersionIndex] = useState(-1)
  const [isLoading,           setIsLoading]          = useState(false)
  const [loadingMode,         setLoadingMode]        = useState(null)
  const [stylePreferences,    setStylePreferencesRaw]   = useState(loadPersistedPrefs)

  // Wrap setter to also persist to localStorage whenever the user changes prefs
  const setStylePreferences = useCallback((newPrefs) => {
    setStylePreferencesRaw(newPrefs)
    try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(newPrefs)) } catch { /* quota exceeded */ }
  }, [])
  const [attachedImage,       setAttachedImage]      = useState(null)
  // Section-level state (the live editing base)
  const [currentSections,     setCurrentSections]    = useState([])
  const [currentTitle,        setCurrentTitle]       = useState('')
  // For section-flash in PreviewPanel
  const [changedSectionNames, setChangedSectionNames] = useState([])

  // ── DebugPanel state ──────────────────────────────────────────────────────
  const [debugInfo, setDebugInfo] = useState({
    lastRequest: null,
    lastResponse: null,
    assembledStats: null,
    iframeStats: null,
    parseErrors: [],
    fallbacks: [],
    lastSystemPrompt: null,
    lastAssembledHTML: null,
  })

  const currentSite =
    activeVersionIndex >= 0 && activeVersionIndex < versions.length
      ? versions[activeVersionIndex].site
      : null

  const addMessage = useCallback((role, content, type = 'text', imageSrc = null, metadata = null) => {
    setMessages((prev) => [...prev, makeMessage(role, content, type, imageSrc, metadata)])
  }, [])

  const clearAttachedImage = useCallback(() => {
    setAttachedImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }, [])

  const attachImage = useCallback((file) => {
    setAttachedImage({ file, previewUrl: URL.createObjectURL(file) })
  }, [])

  const setActiveVersion = useCallback((idx) => {
    setActiveVersionIndex(idx)
    if (idx >= 0) {
      const v = versions[idx]
      if (v?.site?.sections) {
        setCurrentSections(v.site.sections)
        setCurrentTitle(v.site.title || '')
      }
    }
  }, [versions])

  const generateWebsite = useCallback(
    async (prompt) => {
      if (isLoading) return

      const hasImage     = attachedImage !== null
      const isRefinement = currentSections.length > 0 && !hasImage
      const mode         = hasImage ? 'vision' : isRefinement ? 'refine' : 'generate'

      // Append ?debug=true to backend URL when debug mode is on
      const debugParam = IS_DEBUG ? '?debug=true' : ''

      addMessage('user', prompt, 'text', attachedImage?.previewUrl ?? null)
      setIsLoading(true)
      setLoadingMode(mode)
      setChangedSectionNames([])

      const imageFile = attachedImage?.file ?? null
      clearAttachedImage()

      console.group('[WEBSITE_BUILDER]')

      try {
        let site     // WebsiteOutput-shaped object
        let metadata // message metadata

        // ── Vision path ───────────────────────────────────────────────────────
        if (hasImage && imageFile) {
          const endpoint = `${API_BASE}/generate-vision${debugParam}`
          console.log('[REQUEST_SENT]', {
            endpoint,
            promptLength: prompt.length,
            hasSections: currentSections.length > 0,
            hasImage: true,
            stylePrefs: stylePreferences,
          })
          setDebugInfo((d) => ({
            ...d,
            lastRequest: {
              endpoint,
              timestamp: new Date().toISOString(),
              promptPreview: prompt.slice(0, 80),
              hasImage: true,
              stylePrefs: stylePreferences,
            },
          }))

          const fd = new FormData()
          fd.append('prompt', prompt)
          fd.append('image',  imageFile)
          fd.append('style_preferences', JSON.stringify(stylePreferences))
          const res = await fetch(endpoint, { method: 'POST', body: fd })
          if (!res.ok) throw await _extractError(res)
          site = await res.json()

          console.log('[RESPONSE_RAW]', site)
          console.log('[SECTIONS_RECEIVED]', site.sections?.map((s) => ({
            name: s.section,
            htmlChars: s.html?.length ?? 0,
            cssChars: s.css?.length ?? 0,
            jsChars: s.js?.length ?? 0,
            htmlPreview: s.html?.slice(0, 150),
          })))

          if (IS_DEBUG && site.debug_system_prompt) {
            setDebugInfo((d) => ({ ...d, lastSystemPrompt: site.debug_system_prompt }))
          }

          metadata = {
            type: 'vision',
            sections_count: site.sections?.length ?? 0,
            time_ms: site.generation_time_ms,
            tokens: site.token_count,
          }

        // ── Refine path ───────────────────────────────────────────────────────
        } else if (isRefinement) {
          const endpoint = `${API_BASE}/refine${debugParam}`
          console.log('[REQUEST_SENT]', {
            endpoint,
            promptLength: prompt.length,
            hasSections: currentSections.length,
            hasImage: false,
            stylePrefs: stylePreferences,
          })
          setDebugInfo((d) => ({
            ...d,
            lastRequest: {
              endpoint,
              timestamp: new Date().toISOString(),
              promptPreview: prompt.slice(0, 80),
              hasImage: false,
              stylePrefs: stylePreferences,
            },
          }))

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              title: currentTitle,
              current_sections: currentSections,
              style_preferences: stylePreferences,
            }),
          })
          if (!res.ok) throw await _extractError(res)
          const refinement = await res.json()

          console.log('[RESPONSE_RAW]', refinement)
          console.log('[SECTIONS_RECEIVED changed]', refinement.changed_sections?.map((s) => ({
            name: s.section,
            htmlChars: s.html?.length ?? 0,
            cssChars: s.css?.length ?? 0,
            jsChars: s.js?.length ?? 0,
            htmlPreview: s.html?.slice(0, 150),
          })))

          if (IS_DEBUG && refinement.debug_system_prompt) {
            setDebugInfo((d) => ({ ...d, lastSystemPrompt: refinement.debug_system_prompt }))
          }

          if (refinement.fallback) {
            console.warn('[FALLBACK] Backend fell back to full regen for refine.')
            setDebugInfo((d) => ({
              ...d,
              fallbacks: [...d.fallbacks, { timestamp: new Date().toISOString(), prompt }],
            }))
          }

          const mergedSections = mergeSections(currentSections, refinement)
          const newTitle       = refinement.title || currentTitle
          const fullDoc        = assembleSections(mergedSections, newTitle)

          console.log('[ASSEMBLED_HTML]', fullDoc.slice(0, 500))
          console.log('[IFRAME_SRCDOC_LENGTH]', fullDoc.length)

          // Build a site-shaped object for version history + preview
          // NOTE: combineHTML always uses sections[] for rendering (with scoped CSS)
          // so full_html/full_css are not needed here.
          site = {
            title:    newTitle,
            sections: mergedSections,
            generation_time_ms: refinement.generation_time_ms,
            token_count: refinement.token_count,
          }

          const changed   = refinement.changed_sections.map((s) => s.section)
          const unchanged = refinement.unchanged_section_names
          setChangedSectionNames(changed)
          metadata = {
            type: 'refine',
            changed,
            unchanged,
            fallback: refinement.fallback,
            time_ms: refinement.generation_time_ms,
            tokens: refinement.token_count,
          }

          setDebugInfo((d) => ({
            ...d,
            lastResponse: {
              title: newTitle,
              sectionsReceived: changed,
              unchangedSections: unchanged,
              fallback: refinement.fallback,
            },
            assembledStats: {
              totalChars: fullDoc.length,
              sectionCount: mergedSections.length,
              cssChars: mergedSections.map((s) => s.css || '').join('').length,
              jsChars: mergedSections.filter((s) => s.js?.trim()).map((s) => s.js).join('').length,
            },
            lastAssembledHTML: fullDoc,
          }))

        // ── Generate path ─────────────────────────────────────────────────────
        } else {
          const endpoint = `${API_BASE}/generate${debugParam}`
          console.log('[REQUEST_SENT]', {
            endpoint,
            promptLength: prompt.length,
            hasSections: false,
            hasImage: false,
            stylePrefs: stylePreferences,
          })
          setDebugInfo((d) => ({
            ...d,
            lastRequest: {
              endpoint,
              timestamp: new Date().toISOString(),
              promptPreview: prompt.slice(0, 80),
              hasImage: false,
              stylePrefs: stylePreferences,
            },
          }))

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, style_preferences: stylePreferences }),
          })
          if (!res.ok) throw await _extractError(res)
          site = await res.json()

          console.log('[RESPONSE_RAW]', site)
          console.log('[SECTIONS_RECEIVED]', site.sections?.map((s) => ({
            name: s.section,
            htmlChars: s.html?.length ?? 0,
            cssChars: s.css?.length ?? 0,
            jsChars: s.js?.length ?? 0,
            htmlPreview: s.html?.slice(0, 150),
          })))

          if (IS_DEBUG && site.debug_system_prompt) {
            setDebugInfo((d) => ({ ...d, lastSystemPrompt: site.debug_system_prompt }))
          }

          // Compute assembled doc for debug stats
          if (site.sections) {
            const fullDoc = assembleSections(site.sections, site.title)
            console.log('[ASSEMBLED_HTML]', fullDoc.slice(0, 500))
            console.log('[IFRAME_SRCDOC_LENGTH]', fullDoc.length)
            setDebugInfo((d) => ({
              ...d,
              lastResponse: {
                title: site.title,
                sectionsReceived: site.sections.map((s) => s.section),
              },
              assembledStats: {
                totalChars: fullDoc.length,
                sectionCount: site.sections.length,
                cssChars: site.sections.map((s) => s.css || '').join('').length,
                jsChars: site.sections.filter((s) => s.js?.trim()).map((s) => s.js).join('').length,
              },
              lastAssembledHTML: fullDoc,
            }))
          }

          metadata = {
            type: 'generate',
            sections_count: site.sections?.length ?? 0,
            time_ms: site.generation_time_ms,
            tokens: site.token_count,
          }
        }

        // Update live section state
        if (site.sections) {
          setCurrentSections(site.sections)
          setCurrentTitle(site.title || '')
        }

        // Push to version history
        const newVersion = makeVersion(site, prompt)
        const newIndex   = versions.length
        setVersions((prev) => [...prev, newVersion])
        setActiveVersionIndex(newIndex)

        const successMsg = mode === 'vision'
          ? `Analysed your sketch! Generated "${site.title}".`
          : mode === 'refine'
          ? metadata.fallback
            ? `Regenerated "${site.title}" (refine fallback).`
            : `Refined "${site.title}" — updated: ${metadata.changed.join(', ')}.`
          : `Generated "${site.title}" with ${metadata.sections_count} sections.`

        addMessage('assistant', successMsg, 'text', null, metadata)

      } catch (err) {
        const errMsg = typeof err === 'string' ? err
          : `Error: ${err.message || 'Unknown error'}. Is the backend running?`
        console.error('[ERROR]', err)
        setDebugInfo((d) => ({
          ...d,
          parseErrors: [...d.parseErrors, { timestamp: new Date().toISOString(), message: errMsg }],
        }))
        addMessage('assistant', errMsg, 'error')
      } finally {
        setIsLoading(false)
        setLoadingMode(null)
        console.groupEnd()
      }
    },
    [isLoading, currentSections, currentTitle, versions, attachedImage,
     stylePreferences, addMessage, clearAttachedImage],
  )

  return {
    messages,
    versions,
    activeVersionIndex,
    currentSite,
    isLoading,
    loadingMode,
    stylePreferences,
    attachedImage,
    changedSectionNames,
    debugInfo,
    isDebugMode: IS_DEBUG,
    onGenerate: generateWebsite,
    setActiveVersion,
    setStylePreferences,
    attachImage,
    clearAttachedImage,
  }
}

async function _extractError(res) {
  try {
    const body   = await res.json()
    const detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    return `Server error ${res.status}: ${detail}`
  } catch {
    return `Server error ${res.status}: ${res.statusText}`
  }
}
