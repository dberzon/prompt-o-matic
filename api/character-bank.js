import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import {
  createBankEntry,
  deleteBankEntry,
  getBankEntry,
  getBankEntryBySlug,
  listBankEntries,
  updateBankEntry,
} from './lib/db/repositories.js'
import { resolveExplicitProjectIdForRequest } from './lib/projects/context.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function entryMatchesProjectFilter(entry, filterProjectId) {
  if (!filterProjectId) return true
  if (!entry) return false
  if (entry.projectId == null) return true
  return entry.projectId === filterProjectId
}

export default async function handler(req, res) {
  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const url = new URL(req.url || '', 'http://localhost')
    const filterProjectId = resolveExplicitProjectIdForRequest(db, req)

    if (req.method === 'GET') {
      const id = url.searchParams.get('id')
      const slug = url.searchParams.get('slug')
      if (id) {
        const item = getBankEntry(db, id)
        if (!item || !entryMatchesProjectFilter(item, filterProjectId)) {
          return sendJsonNode(res, 404, { error: 'Not found' })
        }
        return sendJsonNode(res, 200, { ok: true, item })
      }
      if (slug) {
        const item = getBankEntryBySlug(db, slug)
        if (!item || !entryMatchesProjectFilter(item, filterProjectId)) {
          return sendJsonNode(res, 404, { error: 'Not found' })
        }
        return sendJsonNode(res, 200, { ok: true, item })
      }
      const items = listBankEntries(db, { projectId: filterProjectId || undefined })
      return sendJsonNode(res, 200, { ok: true, items })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      try {
        const item = createBankEntry(db, body || {})
        return sendJsonNode(res, 200, { ok: true, item })
      } catch (err) {
        if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return sendJsonNode(res, 409, { error: 'Slug already exists', code: 'SLUG_COLLISION' })
        }
        throw err
      }
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req)
      const id = body?.id
      if (!id) return sendJsonNode(res, 400, { error: 'Missing id' })
      const { id: _ignored, ...patch } = body
      try {
        const item = updateBankEntry(db, id, patch)
        if (!item) return sendJsonNode(res, 404, { error: 'Not found' })
        return sendJsonNode(res, 200, { ok: true, item })
      } catch (err) {
        if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return sendJsonNode(res, 409, { error: 'Slug already exists', code: 'SLUG_COLLISION' })
        }
        throw err
      }
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) return sendJsonNode(res, 400, { error: 'Missing id' })
      const deleted = deleteBankEntry(db, id)
      if (!deleted) return sendJsonNode(res, 404, { error: 'Not found' })
      return sendJsonNode(res, 200, { ok: true, deleted: true })
    }

    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BANK_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
