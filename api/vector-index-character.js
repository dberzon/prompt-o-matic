import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertVectorOperationAllowed } from './lib/vector/access.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { indexCharacterById, parseIndexCharacterRequest } from './lib/vector/maintenance.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  let runtime = null
  try {
    assertVectorOperationAllowed('index-character', process.env)
    const body = req.body || {}
    const parsed = parseIndexCharacterRequest(body)
    runtime = createVectorRuntime()
    const result = await indexCharacterById({
      db: runtime.db,
      vectorStore: runtime.vectorStore,
      embeddingProvider: runtime.embeddingProvider,
      id: parsed.id,
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'VECTOR_INDEX_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
