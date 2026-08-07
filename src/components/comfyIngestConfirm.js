/**
 * Decide which promptIds from an ingest-many response were actually stored.
 * /api/comfy-ingest-many always returns HTTP 200 with top-level ok:true when the
 * handler runs; per-item failures are reported on items[].ok.
 *
 * Callers must only mark promptIds as "already ingested" after this filter —
 * otherwise a transient per-item failure permanently skips retry.
 *
 * @param {Array<{ promptId?: string }>} requestedJobs
 * @param {{ items?: Array<{ promptId?: string, ok?: boolean }> } | null | undefined} ingestResult
 * @returns {string[]}
 */
export function confirmedIngestPromptIds(requestedJobs, ingestResult) {
  const requested = Array.isArray(requestedJobs)
    ? requestedJobs.map((j) => j?.promptId).filter((id) => typeof id === 'string' && id.length > 0)
    : []
  if (!requested.length) return []

  const items = ingestResult?.items
  if (!Array.isArray(items)) {
    // Older/malformed payloads: do not treat as confirmed — force retry.
    return []
  }

  const okIds = new Set(
    items.filter((item) => item && item.ok === true && typeof item.promptId === 'string').map((item) => item.promptId),
  )
  return requested.filter((id) => okIds.has(id))
}
