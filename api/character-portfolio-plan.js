import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { assertPromptPackOperationAllowed } from './lib/prompts/access.js'
import { generateCharacterPortfolioPlan } from './lib/portfolio/characterPortfolio.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertPromptPackOperationAllowed('compile-character', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const body = req.body || {}
    const result = generateCharacterPortfolioPlan({
      db: runtime.db,
      characterId: body.characterId,
      views: body.views,
      workflowId: body.workflowId,
      options: body.options || {},
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_PORTFOLIO_PLAN_ERROR' })
  } finally {
    runtime?.close?.()
  }
}

