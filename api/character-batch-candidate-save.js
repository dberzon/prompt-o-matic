import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { saveCandidateAsCharacter } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('candidate-save', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const result = await saveCandidateAsCharacter(runtime, req.body || {})
    if (!result) return sendJsonNode(res, 404, { error: 'Candidate not found' })
    if (result.warning) return sendJsonNode(res, 200, { ok: false, warning: result.warning, matches: result.matches })
    return sendJsonNode(res, 200, { ok: true, item: result })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_CANDIDATE_SAVE_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
