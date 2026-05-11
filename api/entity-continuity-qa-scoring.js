import {
  createContinuityQaScoringTemplate,
  decideContinuityQaAcceptance,
} from './lib/continuity/continuityQaScoring.js'
import { getEntity } from './lib/db/repositories.js'
import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityIdFromRequest(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/continuity-qa\/(scoring-sheet|scores)\/?$/)
  if (!match) return null
  return {
    entityId: decodeURIComponent(match[1]),
    action: match[2],
  }
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body
  return readJsonBody(req)
}

export default async function handler(req, res) {
  const route = parseEntityIdFromRequest(req)
  if (!route?.entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, route.entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    if (route.action === 'scoring-sheet') {
      if (req.method !== 'GET') {
        return sendJsonNode(res, 405, { error: 'Method not allowed' })
      }
      return sendJsonNode(res, 200, {
        ok: true,
        ...createContinuityQaScoringTemplate({ entityId: entity.id, subject: entity.name }),
      })
    }

    if (route.action === 'scores') {
      if (req.method !== 'POST') {
        return sendJsonNode(res, 405, { error: 'Method not allowed' })
      }
      const body = await readRequestBody(req)
      const result = decideContinuityQaAcceptance(body?.scoringSheet || body)
      return sendJsonNode(res, 200, { ok: true, entityId: entity.id, ...result })
    }

    return sendJsonNode(res, 404, { error: 'Unsupported continuity QA route' })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_CONTINUITY_QA_SCORING_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
