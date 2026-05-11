import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import {
  archiveEntity,
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
} from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities(?:\/([^/]+))?\/?$/)
  const pathId = match?.[1] ? decodeURIComponent(match[1]) : ''
  const queryId = typeof req.query?.id === 'string' ? req.query.id : ''
  return {
    url,
    id: pathId || queryId || undefined,
  }
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body
  return readJsonBody(req)
}

export default async function handler(req, res) {
  const { url, id } = parseEntityRoute(req)
  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db

    if (req.method === 'GET') {
      if (id) {
        const item = getEntity(db, id)
        if (!item) return sendJsonNode(res, 404, { error: 'Entity not found' })
        return sendJsonNode(res, 200, { ok: true, item })
      }
      const type = url.searchParams.get('type') || undefined
      const includeArchived = url.searchParams.get('includeArchived') === 'true'
      const items = listEntities(db, { type, includeArchived })
      return sendJsonNode(res, 200, { ok: true, items, total: items.length })
    }

    if (req.method === 'POST') {
      const body = await readRequestBody(req)
      const item = createEntity(db, body || {})
      return sendJsonNode(res, 200, { ok: true, item })
    }

    if (req.method === 'PUT') {
      const body = await readRequestBody(req)
      const entityId = id || body?.id
      if (!entityId) return sendJsonNode(res, 400, { error: 'Missing entity id' })
      const { id: _ignored, ...patch } = body || {}
      const item = updateEntity(db, entityId, patch)
      if (!item) return sendJsonNode(res, 404, { error: 'Entity not found' })
      return sendJsonNode(res, 200, { ok: true, item })
    }

    if (req.method === 'DELETE') {
      const entityId = id || url.searchParams.get('id')
      if (!entityId) return sendJsonNode(res, 400, { error: 'Missing entity id' })
      const archived = archiveEntity(db, entityId)
      if (!archived) return sendJsonNode(res, 404, { error: 'Entity not found' })
      return sendJsonNode(res, 200, { ok: true, archived: true })
    }

    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITIES_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
