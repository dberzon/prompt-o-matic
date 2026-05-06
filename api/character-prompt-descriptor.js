import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { generateCharacterPromptDescriptor, setCharacterPromptDescriptor } from './lib/characters/promptDescriptor.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const characterId = req.body?.characterId
    if (!characterId) return sendJsonNode(res, 400, { error: 'Missing characterId' })
    if (typeof req.body?.descriptor === 'string') {
      const item = setCharacterPromptDescriptor(runtime.db, characterId, req.body.descriptor)
      return sendJsonNode(res, 200, { ok: true, promptDescriptor: item.promptDescriptor ?? '' })
    }
    const result = await generateCharacterPromptDescriptor({
      db: runtime.db,
      characterId,
      env: process.env,
    })
    return sendJsonNode(res, 200, { ok: true, ...result })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_PROMPT_DESCRIPTOR_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
