import { mapErrors } from './bibles.js'
import { apiPost } from './http.js'

/**
 * @param {string} entityId
 * @param {{ maxIterations?: number, budgetTokens?: number }} [opts]
 * @returns {Promise<{ runId: string }>}
 */
export function startAutofillBible(entityId, opts = {}) {
  const body = {
    entityId,
    ...(opts.maxIterations != null ? { maxIterations: opts.maxIterations } : {}),
    ...(opts.budgetTokens != null ? { budgetTokens: opts.budgetTokens } : {}),
  }
  return mapErrors(apiPost('/api/agents/autofill-bible', body))
}
