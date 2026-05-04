import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { updateCharacter } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

const VALID = ['draft', 'auditioned', 'portfolio_pending', 'ready', 'finalized', 'preview']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('update-lifecycle', process.env)
    const body = req.body || {}
    const { characterId, lifecycleStatus } = body
    if (!characterId) return sendJsonNode(res, 400, { error: 'Missing characterId' })
    if (!VALID.includes(lifecycleStatus)) {
      return sendJsonNode(res, 400, { error: `Invalid lifecycleStatus. Valid: ${VALID.join(', ')}` })
    }
    runtime = createVectorRuntime({ env: process.env })
    const updated = updateCharacter(runtime.db, characterId, { lifecycleStatus })
    if (!updated) return sendJsonNode(res, 404, { error: 'Character not found' })
    return sendJsonNode(res, 200, { ok: true, item: updated })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_LIFECYCLE_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
