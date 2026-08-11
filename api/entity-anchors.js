import {
  normalizeHandlerError,
  readJsonBody,
  readMultipartForm,
  sendJsonNode,
} from './lib/http.js'
import { validateReferenceImageBytes } from './lib/continuity/referenceImageBytes.js'
import {
  createVisualAnchor,
  deleteVisualAnchor,
  getEntity,
  listVisualAnchors,
  setPrimaryAnchor,
} from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseAnchorRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/anchors(?:\/([^/]+)(?:\/(set-primary))?)?\/?$/)
  return {
    url,
    entityId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
    anchorId: match?.[2] ? decodeURIComponent(match[2]) : undefined,
    setPrimary: match?.[3] === 'set-primary',
  }
}

function serializeAnchor(item) {
  if (!item) return null
  const payload = item.payload
  if (!Buffer.isBuffer(payload)) return item
  return {
    ...item,
    payload: payload.toString('base64'),
    payloadEncoding: 'base64',
  }
}

function getAnchorForEntity(db, entityId, anchorId) {
  return listVisualAnchors(db, { entityId }).find((item) => item.id === anchorId) || null
}

async function readCreateAnchorInput(req) {
  if (req.body !== undefined) return req.body
  const contentType = req.headers?.['content-type'] || ''
  if (contentType.includes('multipart/form-data')) {
    return readMultipartForm(req)
  }
  return readJsonBody(req)
}

function resolveCreateAnchorIsPrimary(input, { type, payload }) {
  // Non-reference types must never become primary (sole is_primary slot per entity).
  if (type !== 'reference_image') return false
  const explicit = input?.isPrimary !== undefined
    || input?.fields?.isPrimary !== undefined
  const requested = input?.isPrimary === true
    || input?.isPrimary === 'true'
    || input?.fields?.isPrimary === 'true'
  if (!explicit && Buffer.isBuffer(payload)) {
    return true
  }
  return requested
}

function resolveCreateAnchorPayload(input) {
  if (input?.files?.file?.data) return input.files.file.data
  if (input?.files?.image?.data) return input.files.image.data
  if (Buffer.isBuffer(input?.payload)) return input.payload
  if (typeof input?.payloadBase64 === 'string') return Buffer.from(input.payloadBase64, 'base64')
  if (typeof input?.payload === 'string') return Buffer.from(input.payload, 'utf8')
  return input?.payload ?? null
}

export default async function handler(req, res) {
  const { url, entityId, anchorId, setPrimary } = parseAnchorRoute(req)
  if (!entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    if (setPrimary) {
      if (req.method !== 'POST') return sendJsonNode(res, 405, { error: 'Method not allowed' })
      if (!anchorId) return sendJsonNode(res, 400, { error: 'Missing anchor id in path' })
      const existing = getAnchorForEntity(db, entityId, anchorId)
      if (!existing) return sendJsonNode(res, 404, { error: 'Anchor not found' })
      const ok = setPrimaryAnchor(db, anchorId)
      if (!ok) return sendJsonNode(res, 404, { error: 'Anchor not found' })
      const item = getAnchorForEntity(db, entityId, anchorId)
      return sendJsonNode(res, 200, { ok: true, item: serializeAnchor(item) })
    }

    if (req.method === 'GET') {
      if (anchorId) {
        const item = getAnchorForEntity(db, entityId, anchorId)
        if (!item) return sendJsonNode(res, 404, { error: 'Anchor not found' })
        return sendJsonNode(res, 200, { ok: true, item: serializeAnchor(item) })
      }
      const type = url.searchParams.get('type') || undefined
      const items = listVisualAnchors(db, { entityId, type }).map(serializeAnchor)
      return sendJsonNode(res, 200, { ok: true, entityId, items, total: items.length })
    }

    if (req.method === 'POST') {
      const input = await readCreateAnchorInput(req)
      const type = input?.type || input?.fields?.type
      const payload = resolveCreateAnchorPayload(input)
      if (type === 'reference_image') {
        validateReferenceImageBytes(payload)
      }
      const isPrimary = resolveCreateAnchorIsPrimary(input, { type, payload })
      const item = createVisualAnchor(db, {
        id: input?.id || input?.fields?.id,
        entityId,
        type,
        payload,
        isPrimary,
      })
      return sendJsonNode(res, 200, { ok: true, item: serializeAnchor(item) })
    }

    if (req.method === 'DELETE') {
      const targetId = anchorId || url.searchParams.get('id')
      if (!targetId) return sendJsonNode(res, 400, { error: 'Missing anchor id' })
      const existing = getAnchorForEntity(db, entityId, targetId)
      if (!existing) return sendJsonNode(res, 404, { error: 'Anchor not found' })
      const deleted = deleteVisualAnchor(db, targetId)
      if (!deleted) return sendJsonNode(res, 404, { error: 'Anchor not found' })
      return sendJsonNode(res, 200, { ok: true, deleted: true })
    }

    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_ANCHORS_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
