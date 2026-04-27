import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertVectorOperationAllowed, sanitizeVectorStatusForMode } from './lib/vector/access.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { getVectorStatus } from './lib/vector/maintenance.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  let runtime = null
  try {
    assertVectorOperationAllowed('status', process.env)
    if (String(process.env.APP_MODE || 'local-studio') === 'cloud') {
      return sendJsonNode(res, 200, {
        sqlite: { available: false, dbPath: null },
        chroma: {
          available: false,
          collection: process.env.CHROMA_COLLECTION_CHARACTERS || 'characters',
        },
        embeddings: {
          available: false,
          provider: 'ollama',
          model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
        },
        characters: {
          total: 0,
          byEmbeddingStatus: { not_indexed: 0, pending: 0, embedded: 0, failed: 0 },
        },
      })
    }
    runtime = createVectorRuntime()
    const rawStatus = await getVectorStatus({
      db: runtime.db,
      vectorStore: runtime.vectorStore,
      embeddingProvider: runtime.embeddingProvider,
      env: process.env,
    })
    const status = sanitizeVectorStatusForMode(rawStatus, process.env)
    return sendJsonNode(res, 200, status)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'VECTOR_STATUS_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
