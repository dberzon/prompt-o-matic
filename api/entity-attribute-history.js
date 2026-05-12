import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { getEntity, listAttributeSupersedeChain } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityAttributeHistoryRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/attributes\/([^/]+)\/history\/?$/)
  return {
    entityId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
    attributeId: match?.[2] ? decodeURIComponent(match[2]) : undefined,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const { entityId, attributeId } = parseEntityAttributeHistoryRoute(req)
  if (!entityId || !attributeId) {
    return sendJsonNode(res, 400, { error: 'Missing entity or attribute id in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    const history = listAttributeSupersedeChain(db, { entityId, attributeId })
    if (!history) return sendJsonNode(res, 404, { error: 'Attribute not found' })

    return sendJsonNode(res, 200, { ok: true, ...history })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_ATTRIBUTE_HISTORY_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
