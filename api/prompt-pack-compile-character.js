import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertPromptPackOperationAllowed } from './lib/prompts/access.js'
import { compileCharacterPromptPacks } from './lib/prompts/qwenPromptCompiler.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertPromptPackOperationAllowed('compile-character', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const result = compileCharacterPromptPacks({ db: runtime.db, input: req.body || {} })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'PROMPT_PACK_COMPILE_CHARACTER_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
