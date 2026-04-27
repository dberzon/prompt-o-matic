import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { getBatch } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('get-batch', process.env)
    const id = typeof req.query?.id === 'string' ? req.query.id : ''
    if (!id) {
      return sendJsonNode(res, 400, { error: 'Missing id' })
    }
    runtime = createVectorRuntime({ env: process.env })
    const item = getBatch(runtime.db, id)
    if (!item) return sendJsonNode(res, 404, { error: 'Batch not found' })
    return sendJsonNode(res, 200, { ok: true, item })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_GET_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
