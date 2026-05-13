import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertPromptPackOperationAllowed } from './lib/prompts/access.js'
import { listPromptPacksForCharacter } from './lib/prompts/qwenPromptCompiler.js'
import { resolveExplicitProjectIdForRequest } from './lib/projects/context.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertPromptPackOperationAllowed('list', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const characterId = typeof req.query?.characterId === 'string' ? req.query.characterId : ''
    const filterProjectId = resolveExplicitProjectIdForRequest(runtime.db, req)
    const result = listPromptPacksForCharacter({
      db: runtime.db,
      characterId,
      projectId: filterProjectId || undefined,
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'PROMPT_PACK_LIST_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
