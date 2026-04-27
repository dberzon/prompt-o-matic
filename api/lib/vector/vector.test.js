import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { characterToEmbeddingText } from '../characters/characterToEmbeddingText.js'
import { validCharacterProfile } from '../characters/fixtures.js'
import { createCharacter, getCharacter } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createMockEmbeddingProvider } from '../embeddings/mockEmbeddingProvider.js'
import { createMockVectorStore } from './mockVectorStore.js'
import { findSimilarCharacters, indexCharacter } from './characterIndexing.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-vector-test-'))
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

describe('vector foundation', () => {
  it('mock embedding provider returns deterministic vectors', async () => {
    const provider = createMockEmbeddingProvider()
    const a = await provider.embedText('same input')
    const b = await provider.embedText('same input')
    expect(a).toEqual(b)
  })

  it('successful indexing marks character as embedded', async () => {
    const db = createTempDb()
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_vec_001',
      embeddingStatus: 'not_indexed',
    })
    const embeddingProvider = createMockEmbeddingProvider()
    const vectorStore = createMockVectorStore()

    await indexCharacter({
      db,
      vectorStore,
      embeddingProvider,
      character: { id: 'char_vec_001' },
    })

    const updated = getCharacter(db, 'char_vec_001')
    expect(updated.embeddingStatus).toBe('embedded')
    db.close()
  })

  it('failed indexing marks character as failed', async () => {
    const db = createTempDb()
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_vec_002',
      embeddingStatus: 'not_indexed',
    })

    const vectorStore = {
      async upsert() {
        throw new Error('vector store unavailable')
      },
    }
    const embeddingProvider = createMockEmbeddingProvider()

    await expect(indexCharacter({
      db,
      vectorStore,
      embeddingProvider,
      character: { id: 'char_vec_002' },
    })).rejects.toThrow('vector store unavailable')

    const updated = getCharacter(db, 'char_vec_002')
    expect(updated.embeddingStatus).toBe('failed')
    db.close()
  })

  it('indexing path uses characterToEmbeddingText serializer', async () => {
    const db = createTempDb()
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_vec_003',
      embeddingStatus: 'not_indexed',
    })

    const embedTextSpy = vi.fn(async () => [0.1, 0.2, 0.3])
    const embeddingProvider = { embedText: embedTextSpy }
    const vectorStore = {
      async upsert() {},
    }

    await indexCharacter({
      db,
      vectorStore,
      embeddingProvider,
      character: { id: 'char_vec_003' },
    })

    const expectedText = characterToEmbeddingText(getCharacter(db, 'char_vec_003'))
    expect(embedTextSpy).toHaveBeenCalledWith(expectedText)
    db.close()
  })

  it('similarity search returns normalized results', async () => {
    const vectorStore = createMockVectorStore()
    const embeddingProvider = createMockEmbeddingProvider()

    await vectorStore.upsert({
      id: 'char_a',
      embedding: await embeddingProvider.embedText('alpha person'),
      document: 'alpha person',
      metadata: { characterId: 'char_a' },
    })
    await vectorStore.upsert({
      id: 'char_b',
      embedding: await embeddingProvider.embedText('beta person'),
      document: 'beta person',
      metadata: { characterId: 'char_b' },
    })

    const results = await findSimilarCharacters({
      vectorStore,
      embeddingProvider,
      characterOrText: 'alpha person',
      limit: 2,
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty('characterId')
    expect(results[0]).toHaveProperty('distance')
    expect(results[0]).toHaveProperty('score')
  })
})
