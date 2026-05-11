import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { runContinuityQaGenerations } from './lib/continuity/continuityQaGeneration.js'
import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import { getEntity } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityIdFromRequest(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/continuity-qa\/generate\/?$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const entityId = parseEntityIdFromRequest(req)
  if (!entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    assertComfyOperationAllowed('queue', process.env)
    const body = req.body !== undefined ? req.body : await readJsonBody(req)
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    const comfyService = createComfyService({ env: process.env })
    const result = await runContinuityQaGenerations({
      db,
      entityId,
      comfyService,
      input: body || {},
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_CONTINUITY_QA_GENERATE_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
