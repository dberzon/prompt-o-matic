/**
 * Tracks extrapolation run events + final outcome for GET /status polling
 * (SSE fallback) after POST …?stream / body.stream async runs.
 */

/** @type {Map<string, { dispose: () => void, getSnapshot: () => RunSnapshot }>} */
const trackings = new Map()

/**
 * @typedef {{
 *   events: Array<Record<string, unknown>>
 *   settled: boolean
 *   result: unknown | null
 *   error: string | null
 *   cancelled: boolean
 * }} RunSnapshot
 */

/**
 * @param {string} runId
 * @param {{ subscribe: (cb: (rec: Record<string, unknown> & { seq: number }) => void) => () => void }} bus
 */
export function attachExtrapolationRunTracking(runId, bus) {
  /** @type {RunSnapshot} */
  const snapshot = {
    events: [],
    settled: false,
    result: null,
    error: null,
    cancelled: false,
  }

  const unsub = bus.subscribe((rec) => {
    const { seq: _seq, ...rest } = rec
    snapshot.events.push(rest)
    if (rec.type === 'run:end') {
      snapshot.cancelled = Boolean(rec.cancelled)
    }
  })

  const api = {
    /**
     * @param {unknown} result
     */
    setSuccess(result) {
      snapshot.result = result
      snapshot.settled = true
    },
    /**
     * @param {string} message
     */
    setThrown(message) {
      snapshot.error = message
      snapshot.settled = true
    },
    /** @returns {RunSnapshot} */
    getSnapshot() {
      return {
        events: [...snapshot.events],
        settled: snapshot.settled,
        result: snapshot.result,
        error: snapshot.error,
        cancelled: snapshot.cancelled,
      }
    },
    dispose() {
      unsub()
      trackings.delete(runId)
    },
  }

  trackings.set(runId, api)
  return api
}

/**
 * @param {string} runId
 */
export function getExtrapolationRunTracking(runId) {
  return trackings.get(runId) ?? null
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const disposeTimers = new Map()

/**
 * @param {string} runId
 * @param {{ dispose: () => void }} tracking
 * @param {number} ms
 */
export function scheduleDisposeExtrapolationRunTracking(runId, tracking, ms) {
  const prev = disposeTimers.get(runId)
  if (prev) clearTimeout(prev)
  const t = setTimeout(() => {
    disposeTimers.delete(runId)
    try {
      tracking.dispose()
    } catch {
      /* ignore */
    }
  }, ms)
  disposeTimers.set(runId, t)
}

export function clearExtrapolationRunTrackingForTests() {
  for (const t of disposeTimers.values()) clearTimeout(t)
  disposeTimers.clear()
  for (const tr of [...trackings.values()]) {
    try {
      tr.dispose()
    } catch {
      /* ignore */
    }
  }
  trackings.clear()
}
