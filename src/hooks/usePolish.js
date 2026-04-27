// src/hooks/usePolish.js
import { useState, useCallback } from 'react'

// States: idle | loading | polished | error
export function usePolish() {
  const [state, setState] = useState('idle') // 'idle' | 'loading' | 'polished' | 'error'
  const [polished, setPolished] = useState(null) // string | null
  const [error, setError] = useState(null) // string | null
  const [debug, setDebug] = useState({
    lastRequest: null,
    lastResponse: null,
    lastError: null,
  })

  const polish = useCallback(async ({
    fragments,
    directorName,
    directorNote,
    scene,
    scenario,
    frontPrefix,
    narrativeBeat,
    engine = 'auto',
    localOnly = false,
    embeddedPort = null,
    embeddedSecret = null,
    embeddedModel = null,
  }) => {
    if (!fragments || fragments.length === 0) return

    const requestPayload = {
      fragments,
      directorName: directorName ?? null,
      directorNote: directorNote ?? null,
      scene: scene ?? '',
      scenario: scenario ?? null,
      frontPrefix: frontPrefix ?? '',
      narrativeBeat: typeof narrativeBeat === 'string' && narrativeBeat.trim()
        ? narrativeBeat.trim()
        : null,
      engine,
      localOnly,
      embeddedPort,
      embeddedSecret,
      embeddedModel,
    }

    setState('loading')
    setError(null)
    setDebug((prev) => ({
      ...prev,
      lastRequest: requestPayload,
      lastError: null,
    }))

    try {
      const response = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      const contentType = response.headers.get('content-type') ?? ''
      let data
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        throw new Error(
          response.ok
            ? 'Unexpected non-JSON response from API'
            : `HTTP ${response.status} — API not reachable (run with vercel dev or check server)`
        )
      }

      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      setPolished(data.polished)
      setState('polished')
      setDebug((prev) => ({
        ...prev,
        lastResponse: {
          provider: data?.provider ?? null,
          fallback: data?.fallback ?? null,
          engine: data?.engine ?? null,
        },
      }))
    } catch (err) {
      setError(err.message ?? 'Unknown error')
      setState('error')
      setDebug((prev) => ({
        ...prev,
        lastError: err?.message ?? 'Unknown error',
      }))
    }
  }, [])

  const revert = useCallback(() => {
    setState('idle')
    setPolished(null)
    setError(null)
  }, [])

  const checkHealth = useCallback(async ({
    engine = 'auto',
    localOnly = false,
    embeddedPort = null,
    embeddedSecret = null,
    embeddedModel = null,
  } = {}) => {
    const search = new URLSearchParams({
      engine,
      localOnly: localOnly ? '1' : '0',
    })
    if (embeddedPort) search.set('embeddedPort', String(embeddedPort))
    if (embeddedSecret) search.set('embeddedSecret', String(embeddedSecret))
    if (embeddedModel) search.set('embeddedModel', String(embeddedModel))
    const response = await fetch(`/api/polish-health?${search.toString()}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? `Health check failed (${response.status})`)
    }
    return data
  }, [])

  return { state, polished, error, debug, polish, revert, checkHealth }
}
