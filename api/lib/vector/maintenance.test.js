import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validCharacterProfile } from '../characters/fixtures.js'
import { createCharacter, getCharacter } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createMockEmbeddingProvider } from '../embeddings/mockEmbeddingProvider.js'
import { createMockVectorStore } from './mockVectorStore.js'
import {
  findSimilarCharactersById,
  findSimilarCharactersByText,
  getVectorStatus,
  reindexCharacters,
} from './maintenance.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-maint-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  return db
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('vector maintenance service', () => {
  it('returns status counts', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'status_char_1', embeddingStatus: 'not_indexed' })
    createCharacter(db, { ...validCharacterProfile, id: 'status_char_2', embeddingStatus: 'failed' })

    const status = await getVectorStatus({
      db,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
      env: { SQLITE_DB_PATH: './data/test.sqlite' },
    })

    expect(status.characters.total).toBe(2)
    expect(status.characters.byEmbeddingStatus.not_indexed).toBe(1)
    expect(status.characters.byEmbeddingStatus.failed).toBe(1)
    db.close()
  })

  it('reindexes successfully', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'reindex_ok_1', embeddingStatus: 'not_indexed' })
    createCharacter(db, { ...validCharacterProfile, id: 'reindex_ok_2', embeddingStatus: 'pending' })

    const result = await reindexCharacters({
      db,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
      filters: { limit: 10 },
    })

    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
    expect(getCharacter(db, 'reindex_ok_1').embeddingStatus).toBe('embedded')
    expect(getCharacter(db, 'reindex_ok_2').embeddingStatus).toBe('embedded')
    db.close()
  })

  it('reindex continues on partial failures', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'reindex_mix_ok', embeddingStatus: 'not_indexed' })
    createCharacter(db, { ...validCharacterProfile, id: 'reindex_mix_fail', embeddingStatus: 'not_indexed' })

    const vectorStore = {
      async upsert({ id }) {
        if (id === 'reindex_mix_fail') throw new Error('simulated upsert failure')
      },
      async queryByEmbedding() {
        return []
      },
      async checkAvailability() {
        return { available: true, count: 0 }
      },
    }

    const result = await reindexCharacters({
      db,
      vectorStore,
      embeddingProvider: createMockEmbeddingProvider(),
      filters: { limit: 10 },
    })

    expect(result.processed).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(getCharacter(db, 'reindex_mix_ok').embeddingStatus).toBe('embedded')
    expect(getCharacter(db, 'reindex_mix_fail').embeddingStatus).toBe('failed')
    db.close()
  })

  it('supports similar-by-text', async () => {
    const vectorStore = createMockVectorStore()
    const embeddingProvider = createMockEmbeddingProvider()

    await vectorStore.upsert({
      id: 'sim_text_1',
      embedding: await embeddingProvider.embedText('silent woman in raincoat'),
      metadata: { characterId: 'sim_text_1' },
      document: 'silent woman in raincoat',
    })

    const result = await findSimilarCharactersByText({
      vectorStore,
      embeddingProvider,
      text: 'silent woman in raincoat',
      limit: 3,
    })

    expect(result.ok).toBe(true)
    expect(result.results.length).toBeGreaterThan(0)
  })

  it('supports similar-by-character', async () => {
    const db = createTempDb()
    const vectorStore = createMockVectorStore()
    const embeddingProvider = createMockEmbeddingProvider()

    createCharacter(db, { ...validCharacterProfile, id: 'sim_char_1', embeddingStatus: 'not_indexed' })
    createCharacter(db, { ...validCharacterProfile, id: 'sim_char_2', embeddingStatus: 'not_indexed' })

    await reindexCharacters({
      db,
      vectorStore,
      embeddingProvider,
      filters: { limit: 10 },
    })

    const result = await findSimilarCharactersById({
      db,
      vectorStore,
      embeddingProvider,
      id: 'sim_char_1',
      limit: 5,
    })

    expect(result.ok).toBe(true)
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0]).toHaveProperty('characterId')
    db.close()
  })
})
