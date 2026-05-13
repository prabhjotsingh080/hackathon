/**
 * useWebsiteBuilder.js
 * Central state + API call logic for the GenAI Website Builder.
 */
import { useState, useCallback } from 'react'

// In production, set VITE_API_URL in your Vercel project environment variables
// pointing at your Render backend (e.g. https://genai-website-builder-api.onrender.com).
// For local development it falls back to the local uvicorn server.
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000'

let _idCounter = 0
const nextId = () => ++_idCounter

function makeMessage(role, content, type = 'text') {
  return { id: nextId(), role, content, type, timestamp: new Date() }
}

export function useWebsiteBuilder() {
  const [messages, setMessages]       = useState([])
  const [currentSite, setCurrentSite] = useState(null)
  const [isLoading, setIsLoading]     = useState(false)

  const addMessage = useCallback((role, content, type = 'text') => {
    const msg = makeMessage(role, content, type)
    setMessages((prev) => [...prev, msg])
    return msg
  }, [])

  const generateWebsite = useCallback(
    async (prompt) => {
      if (isLoading) return

      addMessage('user', prompt)
      setIsLoading(true)

      try {
        const res = await fetch(`${API_BASE}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ detail: res.statusText }))
          const detail =
            typeof errBody.detail === 'string'
              ? errBody.detail
              : JSON.stringify(errBody.detail)
          addMessage('assistant', `Error ${res.status}: ${detail}`, 'error')
          return
        }

        const site = await res.json()
        setCurrentSite(site)
        addMessage(
          'assistant',
          `Done! Generated "${site.title}" — your site is live in the preview panel →`,
        )
      } catch (err) {
        addMessage(
          'assistant',
          `Could not reach the backend at ${API_BASE}. Is the server running?\n\nDetails: ${err.message}`,
          'error',
        )
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, addMessage],
  )

  return {
    messages,
    currentSite,
    isLoading,
    onGenerate: generateWebsite,
  }
}
