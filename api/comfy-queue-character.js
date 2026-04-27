import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertComfyOperationAllowed('queue', process.env)
    const body = req.body || {}
    runtime = createVectorRuntime({ env: process.env })
    const service = createComfyService({ env: process.env })
    const result = await service.queueCharacter({
      db: runtime.db,
      characterId: body.characterId,
      views: Array.isArray(body.views) ? body.views : [],
      options: body.options || {},
    })
    return sendJsonNode(res, 200, { ok: true, ...result })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_QUEUE_CHARACTER_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
