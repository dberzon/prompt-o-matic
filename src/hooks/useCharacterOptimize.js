import { useState, useCallback } from 'react'

export function useCharacterOptimize() {
  const [state, setState] = useState('idle')
  const [optimized, setOptimized] = useState(null)
  const [provider, setProvider] = useState(null)
  const [fallback, setFallback] = useState(null)
  const [error, setError] = useState(null)

  const optimize = useCallback(async ({
    description,
    engine = 'auto',
    localOnly = false,
    embeddedPort = null,
    embeddedSecret = null,
    embeddedModel = null,
    localProvider = null,
    lmStudioBaseUrl = null,
    lmStudioModel = null,
  }) => {
    if (!description || !description.trim()) return

    setState('loading')
    setError(null)
    setFallback(null)

    try {
      const response = await fetch('/api/optimize-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          engine,
          localOnly,
          embeddedPort,
          embeddedSecret,
          embeddedModel,
          localProvider,
          lmStudioBaseUrl,
          lmStudioModel,
        }),
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
            : `HTTP ${response.status} — optimize endpoint not reachable (restart dev server)`
        )
      }
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
      setOptimized(data.optimized ?? '')
      setProvider(data.provider ?? null)
      setFallback(data.fallback ?? null)
      setState('optimized')
    } catch (err) {
      setError(err.message ?? 'Unknown error')
      setState('error')
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setOptimized(null)
    setProvider(null)
    setFallback(null)
    setError(null)
  }, [])

  return { state, optimized, provider, fallback, error, optimize, reset }
}

