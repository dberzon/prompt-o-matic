import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertVectorOperationAllowed } from './lib/vector/access.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { parseReindexRequest, reindexCharacters } from './lib/vector/maintenance.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  let runtime = null
  try {
    assertVectorOperationAllowed('reindex-characters', process.env)
    const body = req.body || {}
    const parsed = parseReindexRequest(body)
    runtime = createVectorRuntime()
    const result = await reindexCharacters({
      db: runtime.db,
      vectorStore: runtime.vectorStore,
      embeddingProvider: runtime.embeddingProvider,
      filters: parsed,
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'VECTOR_REINDEX_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
