import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertVectorOperationAllowed } from './lib/vector/access.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { findSimilarCharactersByText, parseSimilarByTextRequest } from './lib/vector/maintenance.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  let runtime = null
  try {
    assertVectorOperationAllowed('similar-by-text', process.env)
    const body = req.body || {}
    const parsed = parseSimilarByTextRequest(body)
    runtime = createVectorRuntime()
    const result = await findSimilarCharactersByText({
      vectorStore: runtime.vectorStore,
      embeddingProvider: runtime.embeddingProvider,
      text: parsed.text,
      limit: parsed.limit,
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'VECTOR_SIMILAR_BY_TEXT_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
