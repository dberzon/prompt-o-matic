import { apiGet, apiPost, apiPut, apiDelete } from './http.js'

/**
 * GET /api/character-bank
 * Returns: { ok: true, items: BankEntry[] }
 */
export function listBankEntries() {
  return apiGet('/api/character-bank')
}

/**
 * GET /api/character-bank?id=<id>
 * Returns: { ok: true, item: BankEntry } or throws on 404.
 */
export function getBankEntry(id) {
  return apiGet('/api/character-bank', { id })
}

/**
 * GET /api/character-bank?slug=<slug>
 * Returns: { ok: true, item: BankEntry } or throws on 404.
 */
export function getBankEntryBySlug(slug) {
  return apiGet('/api/character-bank', { slug })
}

/**
 * POST /api/character-bank
 * Body: { slug, name, description, optimizedDescription? }
 * Returns: { ok: true, item: BankEntry }
 * Throws on 409 SLUG_COLLISION when slug is already taken.
 */
export function createBankEntry(payload) {
  return apiPost('/api/character-bank', payload)
}

/**
 * PUT /api/character-bank
 * Body: { id, ...patch }
 * Returns: { ok: true, item: BankEntry } or throws on 404.
 */
export function updateBankEntry(id, patch) {
  return apiPut('/api/character-bank', { id, ...patch })
}

/**
 * DELETE /api/character-bank?id=<id>
 * Returns: { ok: true, deleted: true } or throws on 404.
 */
export function deleteBankEntry(id) {
  return apiDelete('/api/character-bank', { id })
}
