import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { listGeneratedImageRecords } from './lib/db/repositories.js'
import { assertGeneratedImagesOperationAllowed } from './lib/generatedImages/access.js'

function parseApprovedParam(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertGeneratedImagesOperationAllowed('list', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const query = req.query || {}
    const limit = Number.parseInt(query.limit || '', 10)
    const items = listGeneratedImageRecords(runtime.db, {
      characterId: typeof query.characterId === 'string' ? query.characterId : undefined,
      promptPackId: typeof query.promptPackId === 'string' ? query.promptPackId : undefined,
      viewType: typeof query.viewType === 'string' ? query.viewType : undefined,
      approved: parseApprovedParam(query.approved),
      limit: Number.isFinite(limit) ? limit : undefined,
    })
    return sendJsonNode(res, 200, { ok: true, items })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'GENERATED_IMAGES_LIST_ERROR' })
  } finally {
    runtime?.close?.()
  }
}

