import { assessMvpDoneGateReadiness } from './lib/continuity/mvpDoneGate.js'
import { getEntity } from './lib/db/repositories.js'
import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityIdFromRequest(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/mvp-done-gate\/?$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const entityId = parseEntityIdFromRequest(req)
  if (!entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })
    const readiness = assessMvpDoneGateReadiness(db, entityId)
    return sendJsonNode(res, 200, { ok: true, ...readiness })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_MVP_DONE_GATE_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
