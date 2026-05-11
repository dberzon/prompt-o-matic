import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import {
  createRelationship,
  deleteRelationship,
  getEntity,
  listRelationships,
  updateRelationship,
} from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseRelationshipRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/relationships(?:\/([^/]+))?\/?$/)
  return {
    url,
    entityId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
    relationshipId: match?.[2] ? decodeURIComponent(match[2]) : undefined,
  }
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body
  return readJsonBody(req)
}

function listRelationshipsForEntity(db, entityId, filters = {}) {
  const outgoing = listRelationships(db, { fromId: entityId, ...filters })
  const incoming = listRelationships(db, { toId: entityId, ...filters })
  const byId = new Map()
  for (const item of [...outgoing, ...incoming]) {
    byId.set(item.id, item)
  }
  return [...byId.values()]
}

function getRelationshipForEntity(db, entityId, relationshipId) {
  const items = listRelationshipsForEntity(db, entityId)
  return items.find((item) => item.id === relationshipId) || null
}

export default async function handler(req, res) {
  const { url, entityId, relationshipId } = parseRelationshipRoute(req)
  if (!entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    if (req.method === 'GET') {
      if (relationshipId) {
        const item = getRelationshipForEntity(db, entityId, relationshipId)
        if (!item) return sendJsonNode(res, 404, { error: 'Relationship not found' })
        return sendJsonNode(res, 200, { ok: true, item })
      }
      const type = url.searchParams.get('type') || undefined
      const typePrefix = url.searchParams.get('typePrefix') || undefined
      const items = listRelationshipsForEntity(db, entityId, { type, typePrefix })
      return sendJsonNode(res, 200, { ok: true, entityId, items, total: items.length })
    }

    if (req.method === 'POST') {
      const body = await readRequestBody(req)
      const item = createRelationship(db, {
        ...(body || {}),
        fromId: entityId,
      })
      return sendJsonNode(res, 200, { ok: true, item })
    }

    if (req.method === 'PUT') {
      if (!relationshipId) return sendJsonNode(res, 400, { error: 'Missing relationship id in path' })
      const existing = getRelationshipForEntity(db, entityId, relationshipId)
      if (!existing) return sendJsonNode(res, 404, { error: 'Relationship not found' })
      const body = await readRequestBody(req)
      const { id: _ignored, fromId: _fromIgnored, toId: _toIgnored, ...patch } = body || {}
      const item = updateRelationship(db, relationshipId, patch)
      return sendJsonNode(res, 200, { ok: true, item })
    }

    if (req.method === 'DELETE') {
      const targetId = relationshipId || url.searchParams.get('id')
      if (!targetId) return sendJsonNode(res, 400, { error: 'Missing relationship id' })
      const existing = getRelationshipForEntity(db, entityId, targetId)
      if (!existing) return sendJsonNode(res, 404, { error: 'Relationship not found' })
      const deleted = deleteRelationship(db, targetId)
      if (!deleted) return sendJsonNode(res, 404, { error: 'Relationship not found' })
      return sendJsonNode(res, 200, { ok: true, deleted: true })
    }

    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_RELATIONSHIPS_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
