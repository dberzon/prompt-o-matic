/**
 * In-memory progress fan-out with ordered replay for late subscribers.
 *
 * @typedef {{ type: string, seq: number } & Record<string, unknown>} ProgressRecord
 */

const DEFAULT_MAX_EVENTS = 500

/**
 * @param {{ maxEvents?: number }} [opts]
 * @returns {{
 *   emit: (event: Record<string, unknown> & { type: string }) => void
 *   subscribe: (cb: (record: ProgressRecord) => void) => () => void
 *   close: () => void
 *   get closed(): boolean
 * }}
 */
export function createProgressBus({ maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  /** @type {ProgressRecord[]} */
  const ring = []
  /** @type {Set<(record: ProgressRecord) => void>} */
  const subscribers = new Set()
  let seq = 0
  let closed = false
  let runEndEmitted = false

  /**
   * @param {Record<string, unknown> & { type: string }} event
   */
  function emit(event) {
    if (closed) return
    const { type, ...rest } = event
    if (type === 'run:end') {
      if (runEndEmitted) return
      runEndEmitted = true
    }
    seq += 1
    const record = /** @type {ProgressRecord} */ ({ seq, type, ...rest })
    ring.push(record)
    while (ring.length > maxEvents) ring.shift()
    for (const cb of [...subscribers]) {
      try {
        cb(record)
      } catch {
        /* subscriber errors must not kill the bus */
      }
    }
  }

  /**
   * @param {(record: ProgressRecord) => void} cb
   */
  function subscribe(cb) {
    for (const e of ring) {
      try {
        cb(e)
      } catch {
        /* ignore replay errors */
      }
    }
    if (closed) {
      return () => {}
    }
    subscribers.add(cb)
    return () => {
      subscribers.delete(cb)
    }
  }

  function close() {
    if (closed) return
    closed = true
    subscribers.clear()
  }

  return {
    emit,
    subscribe,
    close,
    get closed() {
      return closed
    },
  }
}

/** @type {Map<string, ReturnType<typeof createProgressBus>>} */
const extrapolationRunBuses = new Map()

/**
 * @param {string} runId
 * @param {ReturnType<typeof createProgressBus>} bus
 */
export function registerExtrapolationProgressRun(runId, bus) {
  extrapolationRunBuses.set(runId, bus)
}

/**
 * @param {string} runId
 * @returns {ReturnType<typeof createProgressBus> | null}
 */
export function getExtrapolationProgressRun(runId) {
  return extrapolationRunBuses.get(runId) ?? null
}

/**
 * @param {string} runId
 */
export function unregisterExtrapolationProgressRun(runId) {
  extrapolationRunBuses.delete(runId)
}

/** Test helper: clear registry without closing buses */
export function clearExtrapolationProgressRunsForTests() {
  extrapolationRunBuses.clear()
}
