import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  try {
    assertComfyOperationAllowed('status', process.env)
    const body = req.body || {}
    const workflowId = typeof body.workflowId === 'string' && body.workflowId.trim()
      ? body.workflowId.trim()
      : undefined
    const service = createComfyService({ env: process.env })
    const result = service.validateWorkflow(workflowId)
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_VALIDATE_WORKFLOW_ERROR' })
  }
}
