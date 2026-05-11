import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertPromptPackOperationAllowed } from './lib/prompts/access.js'
import { compileEntityPromptPacks } from './lib/prompts/qwenPromptCompiler.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseEntityIdFromRequest(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const match = url.pathname.match(/^\/api\/promptpack\/from-entity\/([^/]+)\/?$/)
  if (!match) return null
  return decodeURIComponent(match[1])
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
    assertPromptPackOperationAllowed('compile-character', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const result = compileEntityPromptPacks({
      db: runtime.db,
      entityId,
      input: req.body || {},
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'PROMPT_PACK_FROM_ENTITY_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
