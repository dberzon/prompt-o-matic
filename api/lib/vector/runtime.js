import { createOllamaEmbeddingProvider } from '../embeddings/ollamaEmbeddingProvider.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createChromaVectorStore } from './chromaVectorStore.js'

export function createVectorRuntime({ env = process.env } = {}) {
  const db = createSqliteDatabase({ env })
  initializeDatabase(db)
  const vectorStore = createChromaVectorStore({ env })
  const embeddingProvider = createOllamaEmbeddingProvider({ env })

  return {
    db,
    vectorStore,
    embeddingProvider,
    close() {
      db.close()
    },
  }
}
