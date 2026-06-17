/** In-memory coordination for background Bible autofill jobs in this dev-server process. */

/** @type {Map<string, ReturnType<typeof makeRecord>>} */
const activeByEntityId = new Map()
/** @type {Map<string, ReturnType<typeof makeRecord>>} */
const byRunId = new Map()

/**
 * @param {{ runId: string, entityId: string }} args
 */
function makeRecord({ runId, entityId }) {
  let cancelled = false
  let settled = false
  return {
    runId,
    entityId,
    cancel() {
      cancelled = true
    },
    shouldCancel() {
      return cancelled
    },
    isSettled() {
      return settled
    },
    settle() {
      settled = true
      if (activeByEntityId.get(entityId) === this) {
        activeByEntityId.delete(entityId)
      }
      byRunId.delete(runId)
    },
  }
}

/**
 * @param {{ runId: string, entityId: string }} args
 * @returns {{ ok: true, record: ReturnType<typeof makeRecord> } | { ok: false, existingRunId: string }}
 */
export function beginAutofillRun({ runId, entityId }) {
  const existing = activeByEntityId.get(entityId)
  if (existing && !existing.isSettled()) {
    return { ok: false, existingRunId: existing.runId }
  }

  const record = makeRecord({ runId, entityId })
  activeByEntityId.set(entityId, record)
  byRunId.set(runId, record)
  return { ok: true, record }
}

/**
 * @param {string} runId
 * @returns {{ ok: true, entityId: string } | { ok: false }}
 */
export function cancelAutofillRun(runId) {
  const record = byRunId.get(runId)
  if (!record) return { ok: false }
  record.cancel()
  return { ok: true, entityId: record.entityId }
}

export function clearAutofillRunRegistryForTests() {
  activeByEntityId.clear()
  byRunId.clear()
}
