import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { updateGeneratedImageRecord } from './lib/db/repositories.js'
import { assertGeneratedImagesOperationAllowed } from './lib/generatedImages/access.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertGeneratedImagesOperationAllowed('reject', process.env)
    const body = req.body || {}
    if (!body.id) return sendJsonNode(res, 400, { error: 'Missing id' })
    runtime = createVectorRuntime({ env: process.env })
    const item = updateGeneratedImageRecord(runtime.db, body.id, {
      approved: false,
      rejectedReason: typeof body.rejectedReason === 'string' && body.rejectedReason.trim()
        ? body.rejectedReason.trim()
        : undefined,
    })
    if (!item) return sendJsonNode(res, 404, { error: 'Generated image not found' })
    return sendJsonNode(res, 200, { ok: true, item })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'GENERATED_IMAGE_REJECT_ERROR' })
  } finally {
    runtime?.close?.()
  }
}

