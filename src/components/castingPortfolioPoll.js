/**
 * Portfolio Comfy poll helpers.
 *
 * `/api/comfy-jobs-status` returns `{ ok: false, error }` (no `status`) when a
 * per-job Comfy probe throws. That is a transient check failure — not a
 * terminal render failure — so polling must continue.
 */

/**
 * @param {{ ok?: boolean, status?: string } | null | undefined} item
 * @param {{ retryCount?: number } | null | undefined} job
 * @returns {boolean}
 */
export function isPortfolioStatusItemSettled(item, job) {
  if (item?.status === 'success') return true
  if (item?.status === 'failed' && (job?.retryCount ?? 0) >= 2) return true
  return false
}

/**
 * @param {Array<{ ok?: boolean, status?: string }> | null | undefined} items
 * @returns {boolean}
 */
export function isPortfolioBatchTerminalFailure(items) {
  if (!Array.isArray(items) || items.length === 0) return false
  return items.every((item) => item.status === 'failed')
}
