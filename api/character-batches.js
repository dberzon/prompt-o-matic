import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { listBatches } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('list-batches', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const status = typeof req.query?.status === 'string' ? req.query.status : undefined
    const items = listBatches(runtime.db, { status })
    return sendJsonNode(res, 200, { ok: true, items })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_LIST_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
