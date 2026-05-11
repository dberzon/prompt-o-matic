import { dismissEntityConflict, resolveEntityConflict } from './lib/extrapolation/conflictResolution.js'
import { getEntity } from './lib/db/repositories.js'
import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseConflictActionRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/conflicts\/([^/]+)\/(resolve|dismiss)\/?$/)
  return {
    entityId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
    conflictId: match?.[2] ? decodeURIComponent(match[2]) : undefined,
    action: match?.[3],
  }
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body
  return readJsonBody(req)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const { entityId, conflictId, action } = parseConflictActionRoute(req)
  if (!entityId || !conflictId || !action) {
    return sendJsonNode(res, 400, { error: 'Missing entity id, conflict id, or action in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    if (action === 'resolve') {
      const body = await readRequestBody(req)
      const result = resolveEntityConflict(db, entityId, conflictId, {
        winningAttributeId: body?.winningAttributeId,
      })
      return sendJsonNode(res, 200, result)
    }

    if (action === 'dismiss') {
      const result = dismissEntityConflict(db, entityId, conflictId)
      return sendJsonNode(res, 200, result)
    }

    return sendJsonNode(res, 400, { error: 'Unsupported conflict action' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_CONFLICT_ACTION_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
