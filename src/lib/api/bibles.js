import { apiGet, apiPost } from './http.js'

/**
 * @typedef {{ section: string, field: string }} BibleFieldRef
 */

/**
 * @typedef {{
 *   ratio: number
 *   requiredCount: number
 *   recommendedCount: number
 *   presentRequired: number
 *   presentRecommended: number
 *   missingRequired: BibleFieldRef[]
 *   missingRecommended: BibleFieldRef[]
 * }} CompletenessReport
 */

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, payload?: unknown, cause?: unknown }} [opts]
   */
  constructor(message, opts = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'ApiError'
    this.status = opts.status
    this.code = opts.code
    this.payload = opts.payload
  }
}

export class NotFoundError extends ApiError {
  /**
   * @param {string} [message]
   * @param {{ code?: string, payload?: unknown, cause?: unknown }} [opts]
   */
  constructor(message = 'Not found', opts = {}) {
    super(message, { ...opts, status: 404 })
    this.name = 'NotFoundError'
  }
}

/**
 * @template T
 * @param {Promise<T>} p
 * @returns {Promise<T>}
 */
export async function mapErrors(p) {
  try {
    return await p
  } catch (e) {
    const err = /** @type {{ status?: number, message?: string, code?: string, payload?: unknown }} */ (e)
    if (err?.status === 404) {
      throw new NotFoundError(err.message || 'Not found', {
        code: err.code,
        payload: err.payload,
        cause: e,
      })
    }
    if (e instanceof TypeError) {
      throw new ApiError('Network request failed', { cause: e })
    }
    if (typeof err?.status === 'number') {
      throw new ApiError(err.message || `Request failed with status ${err.status}`, {
        status: err.status,
        code: err.code,
        payload: err.payload,
        cause: e,
      })
    }
    throw new ApiError(err?.message || 'Request failed', { cause: e })
  }
}

/**
 * @param {string} entityId
 * @returns {Promise<{ bible: unknown, provenance: unknown, entityType?: string }>}
 */
export async function fetchBible(entityId) {
  const id = encodeURIComponent(entityId)
  const data = await mapErrors(apiGet(`/api/bibles/${id}`))
  const d = /** @type {{ bible?: unknown, provenance?: unknown, entityType?: string }} */ (data)
  return { bible: d.bible, provenance: d.provenance, entityType: d.entityType }
}

/**
 * @param {string} entityId
 * @returns {Promise<CompletenessReport>}
 */
export function fetchBibleCompleteness(entityId) {
  const id = encodeURIComponent(entityId)
  return mapErrors(apiGet(`/api/bibles/${id}/completeness`))
}

/**
 * @param {string} entityId
 * @param {string} section
 * @param {string} [note]
 * @returns {Promise<{ ok: true }>}
 */
export function approveBibleSection(entityId, section, note) {
  const id = encodeURIComponent(entityId)
  const body = note !== undefined && note !== null ? { section, note } : { section }
  return mapErrors(apiPost(`/api/bibles/${id}/approve-section`, body))
}

/**
 * @typedef {{
 *   id: string
 *   entityId: string
 *   projectId?: string | null
 *   label: string
 *   bibleJson: unknown
 *   parentSnapshotId?: string | null
 *   createdAt: string
 * }} SnapshotRecord
 */

/**
 * @param {string} entityId
 * @returns {Promise<SnapshotRecord[]>}
 */
export async function listSnapshots(entityId) {
  const id = encodeURIComponent(entityId)
  const data = await mapErrors(apiGet(`/api/bibles/${id}/snapshots`))
  const d = /** @type {{ snapshots?: SnapshotRecord[] }} */ (data)
  return d.snapshots ?? []
}

/**
 * @param {string} snapshotId
 * @returns {Promise<SnapshotRecord>}
 */
export async function getSnapshot(snapshotId) {
  const id = encodeURIComponent(snapshotId)
  const data = await mapErrors(apiGet(`/api/bibles/snapshots/${id}`))
  const d = /** @type {{ snapshot?: SnapshotRecord }} */ (data)
  if (!d.snapshot) {
    throw new NotFoundError('Snapshot not found')
  }
  return d.snapshot
}
