import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../lib/api/http.js'

const SSE_EVENT_NAMES = [
  'run:start',
  'stage:start',
  'stage:finish',
  'iter:start',
  'iter:end',
  'run:error',
  'run:end',
]

/**
 * @param {string | null | undefined} runId
 * @returns {{
 *   events: Array<Record<string, unknown>>
 *   status: 'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'poll-fallback'
 *   error: string
 *   warning: string
 *   result: unknown | null
 *   close: () => void
 *   liveStage: number
 * }}
 */
export function useExtrapolationStream(runId) {
  const [events, setEvents] = useState(() => /** @type {Array<Record<string, unknown>>} */ ([]))
  const [status, setStatus] = useState(
    /** @type {'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'poll-fallback'} */ ('idle'),
  )
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [result, setResult] = useState(/** @type {unknown | null} */ (null))

  const esRef = useRef(/** @type {EventSource | null} */ (null))
  const pollRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null))

  const close = useCallback(() => {
    if (esRef.current) {
      try {
        esRef.current.close()
      } catch {
        /* ignore */
      }
      esRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!runId) {
      close()
      setEvents([])
      setStatus('idle')
      setError('')
      setWarning('')
      setResult(null)
      return
    }

    close()
    setEvents([])
    setError('')
    setWarning('')
    setResult(null)
    setStatus('connecting')

    let cancelled = false
    let outcomeResolved = false
    let finalizeInFlight = false

    const statusUrl = `/api/extrapolation/${encodeURIComponent(runId)}/status`
    const streamUrl = `/api/extrapolation/${encodeURIComponent(runId)}/stream`

    const applyStatusPayload = (snap) => {
      if (!snap || typeof snap !== 'object') return
      if (Array.isArray(snap.events)) {
        setEvents(snap.events.map((e) => (e && typeof e === 'object' ? { ...e } : {})))
      }
      if (snap.done) {
        outcomeResolved = true
        if (snap.error) {
          setError(String(snap.error))
          setStatus('error')
        } else {
          setResult(snap.result ?? null)
          setStatus('done')
        }
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        try {
          esRef.current?.close()
        } catch {
          /* ignore */
        }
        esRef.current = null
      } else {
        setStatus((s) => (s === 'poll-fallback' ? s : 'streaming'))
      }
    }

    const finalizeOnceFromHttp = async () => {
      if (cancelled || outcomeResolved || finalizeInFlight) return
      finalizeInFlight = true
      try {
        let snap = await apiGet(statusUrl)
        let attempts = 0
        while (!cancelled && snap && snap.done === false && attempts < 80) {
          await new Promise((r) => setTimeout(r, 100))
          snap = await apiGet(statusUrl)
          attempts += 1
        }
        if (cancelled) return
        if (!snap || snap.done !== true) {
          setError('Timed out waiting for extrapolation result')
          setStatus('error')
          outcomeResolved = true
          return
        }
        applyStatusPayload(snap)
      } catch (err) {
        if (cancelled) return
        setError(err?.message || 'Failed to load extrapolation status')
        setStatus('error')
        outcomeResolved = true
      } finally {
        finalizeInFlight = false
      }
    }

    const pollTick = async () => {
      if (cancelled) return
      try {
        const snap = await apiGet(statusUrl)
        if (cancelled) return
        applyStatusPayload(snap)
      } catch {
        /* keep polling until TTL */
      }
    }

    const startPolling = (warn) => {
      if (outcomeResolved || pollRef.current) return
      if (warn) setWarning(warn)
      setStatus('poll-fallback')
      void pollTick()
      pollRef.current = setInterval(() => {
        void pollTick()
      }, 1200)
    }

    const attachNamedListeners = (es) => {
      for (const name of SSE_EVENT_NAMES) {
        es.addEventListener(name, (e) => {
          if (cancelled) return
          try {
            const raw = /** @type {MessageEvent} */ (e).data
            const data = raw ? JSON.parse(String(raw)) : {}
            setEvents((prev) => [...prev, data && typeof data === 'object' ? data : {}])
            setStatus('streaming')
          } catch {
            /* ignore malformed */
          }
          if (name === 'run:end') {
            void finalizeOnceFromHttp()
          }
        })
      }
    }

    if (typeof globalThis.EventSource !== 'function') {
      startPolling('Live progress unavailable in this environment (EventSource missing); using status polling.')
      return () => {
        cancelled = true
        close()
      }
    }

    try {
      const es = new EventSource(streamUrl)
      esRef.current = es
      attachNamedListeners(es)
      es.onerror = () => {
        if (cancelled || outcomeResolved) return
        try {
          es.close()
        } catch {
          /* ignore */
        }
        esRef.current = null
        startPolling('Progress stream interrupted; using status polling.')
      }
    } catch {
      startPolling('Could not open progress stream; using status polling.')
    }

    return () => {
      cancelled = true
      close()
    }
  }, [runId, close])

  const liveStage = useMemo(() => {
    let n = 0
    for (const ev of events) {
      if (
        (ev?.type === 'stage:start' || ev?.type === 'stage:finish')
        && typeof ev.stageId === 'number'
      ) {
        n = Math.max(n, ev.stageId)
      }
    }
    return n
  }, [events])

  return {
    events,
    status,
    error,
    warning,
    result,
    close,
    liveStage,
  }
}
