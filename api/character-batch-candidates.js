import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { listCandidatesForBatch } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('list-candidates', process.env)
    const batchId = typeof req.query?.batchId === 'string' ? req.query.batchId : ''
    if (!batchId) {
      return sendJsonNode(res, 400, { error: 'Missing batchId' })
    }
    runtime = createVectorRuntime({ env: process.env })
    const items = listCandidatesForBatch(runtime.db, {
      batchId,
      classification: typeof req.query?.classification === 'string' ? req.query.classification : undefined,
      reviewStatus: typeof req.query?.reviewStatus === 'string' ? req.query.reviewStatus : undefined,
    })
    return sendJsonNode(res, 200, { ok: true, items })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_CANDIDATE_LIST_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
