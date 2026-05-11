import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { triggerStage5ReferenceImageGeneration } from './lib/extrapolation/stage5ReferenceGeneration.js'
import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityIdFromRequest(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/entities\/([^/]+)\/extrapolate\/stage\/5\/?$/)
  if (!match) return null
  return decodeURIComponent(match[1])
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
    const comfyService = createComfyService({ env: process.env })
    const result = await triggerStage5ReferenceImageGeneration({
      db: runtime.db,
      entityId,
      comfyService,
      input: body || {},
    })
    return sendJsonNode(res, 200, {
      ...result,
      anchor: serializeAnchor(result.anchor),
    })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_EXTRAPOLATE_STAGE5_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
