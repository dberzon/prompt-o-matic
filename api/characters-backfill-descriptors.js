import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { backfillCharacterPromptDescriptors } from './lib/characters/promptDescriptor.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const result = await backfillCharacterPromptDescriptors({ db: runtime.db, env: process.env })
    return sendJsonNode(res, 200, { ok: true, ...result })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTERS_BACKFILL_DESCRIPTORS_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
