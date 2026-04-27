import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  try {
    assertComfyOperationAllowed('read-job', process.env)
    const promptId = typeof req.query?.id === 'string' ? req.query.id : ''
    if (!promptId) return sendJsonNode(res, 400, { error: 'Missing id' })
    const service = createComfyService({ env: process.env })
    const status = await service.getJobStatus(promptId)
    return sendJsonNode(res, 200, { ok: true, ...status })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_JOB_STATUS_ERROR' })
  }
}
