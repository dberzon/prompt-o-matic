import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  try {
    assertComfyOperationAllowed('status', process.env)
    const service = createComfyService({ env: process.env })
    const result = service.listWorkflows()
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_WORKFLOWS_ERROR' })
  }
}
