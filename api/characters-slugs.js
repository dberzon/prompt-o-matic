import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { listCharacterSlugs } from './lib/db/repositories.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const items = listCharacterSlugs(runtime.db)
    return sendJsonNode(res, 200, { ok: true, items })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTERS_SLUGS_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
