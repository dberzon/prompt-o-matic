import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import {
  createEntity,
  getEntity,
  listAttributes,
  writeAttribute,
} from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body
  return readJsonBody(req)
}

function attributeValueFromDescription(description) {
  const trimmed = String(description || '').trim()
  return trimmed || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  let runtime = null
  try {
    const body = await readRequestBody(req)
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const optimizedDescription = typeof body?.optimizedDescription === 'string'
      ? body.optimizedDescription.trim()
      : ''
    if (!slug || !name) {
      return sendJsonNode(res, 400, { error: 'Missing slug or name' })
    }

    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const existed = Boolean(getEntity(db, slug))
    let entity = getEntity(db, slug)
    if (!entity) {
      entity = createEntity(db, { id: slug, type: 'character', name })
    }

    const existing = listAttributes(db, { entityId: entity.id })
    const hasCanonDescription = existing.some((item) => item.key === 'description' && item.provenance === 'canon')
    if (!hasCanonDescription) {
      const value = attributeValueFromDescription(optimizedDescription || description)
      if (value) {
        writeAttribute(db, {
          entityId: entity.id,
          key: 'description',
          value,
          provenance: 'canon',
          confidence: 1,
          sourceStage: 'lift',
        })
      }
    }

    return sendJsonNode(res, 200, {
      ok: true,
      entity,
      created: !existed,
    })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_LIFT_FROM_BANK_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
