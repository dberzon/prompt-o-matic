import { createOllamaEmbeddingProvider } from '../embeddings/ollamaEmbeddingProvider.js'
import { createLmStudioEmbeddingProvider } from '../embeddings/lmStudioEmbeddingProvider.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createChromaVectorStore } from './chromaVectorStore.js'

function createEmbeddingProvider({ env }) {
  const provider = String(env.LLM_PROVIDER || '').toLowerCase()
  if (provider === 'lmstudio') return createLmStudioEmbeddingProvider({ env })
  return createOllamaEmbeddingProvider({ env })
}

export function createVectorRuntime({ env = process.env } = {}) {
  const db = createSqliteDatabase({ env })
  initializeDatabase(db)
  const vectorStore = createChromaVectorStore({ env })
  const embeddingProvider = createEmbeddingProvider({ env })

  return {
    db,
    vectorStore,
    embeddingProvider,
    close() {
      db.close()
    },
  }
}
