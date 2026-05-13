import { useCallback, useRef, useState } from 'react'
import { apiPost } from '../lib/api/http.js'

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
 * @param {{ entityId: string }} params
 */
export function useExtrapolation({ entityId } = {}) {
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setRunning(false)
    busyRef.current = false
    setStatus('Cancelled')
  }, [])

  const run = useCallback(async () => {
    if (!entityId || busyRef.current) return null
    busyRef.current = true
    cancelledRef.current = false
    setRunning(true)
    setError('')
    setStage(0)
    setStatus('Starting extrapolation…')
    setResult(null)
    try {
      const raw = await apiPost(`/api/extrapolate/character/${encodeURIComponent(entityId)}`, {})
      if (cancelledRef.current) return null
      const stages = normalizeExtrapolationStages(raw?.stages)
      const next = raw && typeof raw === 'object' ? { ...raw, stages } : { stages }
      setResult(next)
      setStage(stages.length || 6)
      setStatus(
        raw?.cancelled
          ? 'Extrapolation cancelled.'
          : 'Extrapolation complete. Review inferred attributes below.',
      )
      return next
    } catch (err) {
      setError(err?.message || 'Extrapolation failed')
      setStatus('')
      return null
    } finally {
      busyRef.current = false
      setRunning(false)
    }
  }, [entityId])

  return {
    run,
    cancel,
    running,
    stage,
    status,
    error,
    result,
  }
}
