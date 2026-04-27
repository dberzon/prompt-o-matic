import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { listCharacters } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('list-characters', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const projectId = typeof req.query?.projectId === 'string' ? req.query.projectId : undefined
    const items = listCharacters(runtime.db, { projectId })
    return sendJsonNode(res, 200, { ok: true, items })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTERS_LIST_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
