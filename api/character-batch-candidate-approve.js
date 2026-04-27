import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { approveCandidate } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('candidate-approve', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const item = approveCandidate(runtime.db, req.body || {})
    if (!item) return sendJsonNode(res, 404, { error: 'Candidate not found' })
    return sendJsonNode(res, 200, { ok: true, item })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_CANDIDATE_APPROVE_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
