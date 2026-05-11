import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { getEntity, listAttributes } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityAttributesRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/attributes\/?$/)
  return {
    entityId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
    includeDismissed: url.searchParams.get('includeDismissed') === 'true',
    includeSuperseded: url.searchParams.get('includeSuperseded') === 'true',
    provenance: url.searchParams.get('provenance') || undefined,
    key: url.searchParams.get('key') || undefined,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const { entityId, includeDismissed, includeSuperseded, provenance, key } = parseEntityAttributesRoute(req)
  if (!entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    const items = listAttributes(db, {
      entityId,
      key,
      provenance,
      includeDismissed,
      includeSuperseded,
    })
    return sendJsonNode(res, 200, { ok: true, entityId, items, total: items.length })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_ATTRIBUTES_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
