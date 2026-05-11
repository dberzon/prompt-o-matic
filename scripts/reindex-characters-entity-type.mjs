/**
 * One-shot reindex: walk the characters table and re-upsert Chroma metadata with entity_type='character'.
 *
 *   node scripts/reindex-characters-entity-type.mjs
 *
 * Optional env:
 *   SQLITE_DB_PATH, CHROMA_*, OLLAMA_*, limit (default 500)
 */

import { listCharacters } from '../api/lib/db/repositories.js'
import { indexCharacter } from '../api/lib/vector/entityIndexing.js'
import { createVectorRuntime } from '../api/lib/vector/runtime.js'

const limit = Number.parseInt(process.env.limit || '500', 10)

const runtime = createVectorRuntime({ env: process.env })
try {
  const targets = listCharacters(runtime.db, { limit })
  const failures = []
  let succeeded = 0

  for (const character of targets) {
    try {
      await indexCharacter({
        db: runtime.db,
        vectorStore: runtime.vectorStore,
        embeddingProvider: runtime.embeddingProvider,
        character: { id: character.id },
      })
      succeeded += 1
      console.log(`indexed ${character.id} entity_type=character`)
    } catch (error) {
      failures.push({ id: character.id, error: error?.message || 'indexing failed' })
      console.warn(`failed ${character.id}: ${error?.message || 'indexing failed'}`)
    }
  }

  console.log(JSON.stringify({
    ok: failures.length === 0,
    processed: targets.length,
    succeeded,
    failed: failures.length,
    failures,
  }, null, 2))
} finally {
  runtime.close()
}
