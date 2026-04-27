import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { assertPromptPackOperationAllowed } from './lib/prompts/access.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { queueCharacterPortfolio } from './lib/portfolio/characterPortfolio.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertPromptPackOperationAllowed('compile-character', process.env)
    assertComfyOperationAllowed('queue', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const service = createComfyService({ env: process.env })
    const body = req.body || {}
    const result = await queueCharacterPortfolio({
      db: runtime.db,
      comfyService: service,
      characterId: body.characterId,
      views: body.views,
      workflowId: body.workflowId,
      options: body.options || {},
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_PORTFOLIO_QUEUE_ERROR' })
  } finally {
    runtime?.close?.()
  }
}

