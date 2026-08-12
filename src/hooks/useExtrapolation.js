import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../lib/api/http.js'
import { useExtrapolationStream } from './useExtrapolationStream.js'

/**
 * Ensures each stage object includes a `dropped` array for UI and tests.
 * @param {unknown} stages
 * @returns {Array<Record<string, unknown> & { dropped: { key: string | null; reason: string; raw?: unknown }[] }>}
 */
export function normalizeExtrapolationStages(stages) {
  if (!Array.isArray(stages)) return []
  return stages.map((st) => {
    if (!st || typeof st !== 'object') {
      return { dropped: [] }
    }
    const row = /** @type {Record<string, unknown>} */ (st)
    const dropped = Array.isArray(row.dropped) ? row.dropped : []
    return { ...row, dropped }
  })
}

/**
 * Human-readable summary when any parser dropped rows (for Continuity UI).
 * @param {unknown} stages
 */
export function formatExtrapolationDropSummary(stages) {
  const normalized = normalizeExtrapolationStages(stages)
  let returned = 0
  let dropCount = 0
  const reasons = new Set()
  for (const st of normalized) {
    const w = st.writes
    returned += Array.isArray(w) ? w.length : 0
    for (const d of st.dropped) {
      dropCount += 1
      if (d && typeof d === 'object' && 'reason' in d && d.reason) {
        reasons.add(String(d.reason))
      }
    }
  }
  if (dropCount === 0) return ''
  const reasonHint =
    reasons.size === 1 ? [...reasons][0].replaceAll('_', ' ') : 'various reasons'
  return `${returned} attributes returned, ${dropCount} dropped (${reasonHint})`
}

/**
 * Poll until an extrapolation run reports done (best-effort; TTL-capped).
 * Used after UI cancel so a second Run cannot overlap the abandoned server pipeline.
 * @param {string} runId
 * @param {{ attempts?: number, intervalMs?: number, apiGetFn?: typeof apiGet }} [opts]
 */
export async function waitForExtrapolationRunSettle(runId, opts = {}) {
  const attempts = opts.attempts ?? 120
  const intervalMs = opts.intervalMs ?? 500
  const get = opts.apiGetFn ?? apiGet
  const statusUrl = `/api/extrapolation/${encodeURIComponent(runId)}/status`
  for (let i = 0; i < attempts; i += 1) {
    try {
      const snap = await get(statusUrl)
      if (snap && snap.done === true) return true
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * @param {{ entityId: string }} params
 */
export function useExtrapolation({ entityId } = {}) {
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)
  const activeRunIdRef = useRef(/** @type {string | null} */ (null))
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [activeRunId, setActiveRunId] = useState(/** @type {string | null} */ (null))

  const stream = useExtrapolationStream(activeRunId)

  const setRunId = useCallback((id) => {
    activeRunIdRef.current = id
    setActiveRunId(id)
  }, [])

  const releaseBusyAfterRun = useCallback(async (runId) => {
    if (typeof runId === 'string' && runId) {
      await waitForExtrapolationRunSettle(runId, { attempts: 120, intervalMs: 100 })
    }
    // Only unlock if UI has not started a newer non-cancelled run.
    if (cancelledRef.current && activeRunIdRef.current == null) {
      busyRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!activeRunId) return
    if (stream.status === 'done' && stream.result) {
      if (cancelledRef.current) {
        setRunId(null)
        busyRef.current = false
        return
      }
      const raw = stream.result
      const stages = normalizeExtrapolationStages(raw?.stages)
      const next = raw && typeof raw === 'object' ? { ...raw, stages } : { stages }
      setResult(next)
      setStage(stages.length || 6)
      setStatus(
        raw?.cancelled
          ? 'Extrapolation cancelled.'
          : 'Extrapolation complete. Review inferred attributes below.',
      )
      setRunning(false)
      busyRef.current = false
      setRunId(null)
      return
    }
    if (stream.status === 'error') {
      if (!cancelledRef.current) {
        setError(stream.error || 'Extrapolation failed')
        setStatus('')
      }
      setRunning(false)
      busyRef.current = false
      setRunId(null)
    }
  }, [activeRunId, stream.status, stream.result, stream.error, setRunId])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    const runId = activeRunIdRef.current
    setRunId(null)
    setRunning(false)
    setStatus('Cancelled')
    // Keep busyRef locked until the abandoned server run settles so Cancel→Run
    // cannot start a second pipeline while the first is still writing.
    if (runId) {
      void releaseBusyAfterRun(runId)
    }
  }, [releaseBusyAfterRun, setRunId])

  const run = useCallback(async () => {
    if (!entityId || busyRef.current) return null
    busyRef.current = true
    cancelledRef.current = false
    setRunning(true)
    setError('')
    setStage(0)
    setStatus('Starting extrapolation…')
    setResult(null)
    setRunId(null)
    try {
      const raw = await apiPost(`/api/extrapolate/character/${encodeURIComponent(entityId)}`, {
        stream: true,
      })
      const runId = raw && typeof raw === 'object' && typeof raw.runId === 'string'
        ? raw.runId
        : null
      if (cancelledRef.current) {
        setRunning(false)
        setStatus('Cancelled')
        if (runId) {
          void releaseBusyAfterRun(runId)
        } else {
          busyRef.current = false
        }
        return null
      }
      if (runId) {
        setRunId(runId)
        return null
      }
      const stages = normalizeExtrapolationStages(raw?.stages)
      const next = raw && typeof raw === 'object' ? { ...raw, stages } : { stages }
      setResult(next)
      setStage(stages.length || 6)
      setStatus(
        raw?.cancelled
          ? 'Extrapolation cancelled.'
          : 'Extrapolation complete. Review inferred attributes below.',
      )
      setRunning(false)
      busyRef.current = false
      return next
    } catch (err) {
      setError(err?.message || 'Extrapolation failed')
      setStatus('')
      setRunning(false)
      busyRef.current = false
      return null
    }
  }, [entityId, releaseBusyAfterRun, setRunId])

  const progressStage = activeRunId ? Math.max(stream.liveStage, 0) : stage
  const streamWarning = activeRunId ? stream.warning : ''

  return {
    run,
    cancel,
    running,
    stage: progressStage,
    status,
    error,
    result,
    streamWarning,
  }
}
