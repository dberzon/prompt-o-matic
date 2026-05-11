import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import {
  dismissSuggested,
  getAttribute,
  getEntity,
  promoteToCanon,
} from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseAttributeActionRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/attributes\/([^/]+)\/(promote|dismiss|edit)\/?$/)
  return {
    entityId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
    attributeId: match?.[2] ? decodeURIComponent(match[2]) : undefined,
    action: match?.[3],
  }
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body
  return readJsonBody(req)
}

function getAttributeForEntity(db, entityId, attributeId) {
  const item = getAttribute(db, attributeId)
  if (!item || item.entityId !== entityId) return null
  return item
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const { entityId, attributeId, action } = parseAttributeActionRoute(req)
  if (!entityId || !attributeId || !action) {
    return sendJsonNode(res, 400, { error: 'Missing entity id, attribute id, or action in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    const existing = getAttributeForEntity(db, entityId, attributeId)
    if (!existing) return sendJsonNode(res, 404, { error: 'Attribute not found' })

    if (action === 'promote') {
      const item = promoteToCanon(db, attributeId)
      return sendJsonNode(res, 200, { ok: true, item })
    }

    if (action === 'edit') {
      const body = await readRequestBody(req)
      if (body?.value === undefined) {
        return sendJsonNode(res, 400, { error: 'Missing value for attribute edit' })
      }
      const item = promoteToCanon(db, attributeId, { value: body.value })
      return sendJsonNode(res, 200, { ok: true, item })
    }

    if (action === 'dismiss') {
      const dismissed = dismissSuggested(db, attributeId)
      if (!dismissed) return sendJsonNode(res, 404, { error: 'Attribute not found' })
      const item = getAttribute(db, attributeId)
      return sendJsonNode(res, 200, { ok: true, item })
    }

    return sendJsonNode(res, 400, { error: 'Unsupported attribute action' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_ATTRIBUTE_ACTION_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
