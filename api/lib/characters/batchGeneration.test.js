import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCharacter, listCharacters } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createMockEmbeddingProvider } from '../embeddings/mockEmbeddingProvider.js'
import { createMockVectorStore } from '../vector/mockVectorStore.js'
import { runBatchCharacterGeneration } from './batchGeneration.js'
import { validCharacterGenerationRequest, validCharacterProfile } from './fixtures.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-batch-test-'))
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

function buildCandidate(id, age = 24) {
  return {
    ...validCharacterProfile,
    id,
    age,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    embeddingStatus: 'not_indexed',
  }
}

describe('batch generation service', () => {
  it('generates valid accepted candidates', async () => {
    const db = createTempDb()
    const llmGenerate = async () => JSON.stringify([buildCandidate('cand_1')])
    const result = await runBatchCharacterGeneration({
      db,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
      llmGenerate,
      input: {
        request: { ...validCharacterGenerationRequest, count: 1, candidateMultiplier: 1 },
      },
    })
    expect(result.summary.accepted).toBe(1)
    expect(result.rejected.length).toBe(0)
    db.close()
  })

  it('fails on invalid LLM JSON', async () => {
    const db = createTempDb()
    const llmGenerate = async () => 'not-json'
    await expect(runBatchCharacterGeneration({
      db,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
      llmGenerate,
      input: {
        request: { ...validCharacterGenerationRequest, count: 1, candidateMultiplier: 1 },
      },
    })).rejects.toThrow('No JSON content found in LLM response')
    db.close()
  })

  it('rejects schema-invalid candidates', async () => {
    const db = createTempDb()
    const llmGenerate = async () => JSON.stringify([{ id: 'bad_only' }])
    const result = await runBatchCharacterGeneration({
      db,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
      llmGenerate,
      input: { request: { ...validCharacterGenerationRequest, count: 1, candidateMultiplier: 1 } },
    })
    expect(result.summary.rejected).toBe(1)
    expect(result.rejected[0].reason).toBe('schema_invalid')
    db.close()
  })

  it('classifies by similarity into accepted/rejected/needsMutation', async () => {
    const db = createTempDb()
    const llmGenerate = async () => JSON.stringify([
      buildCandidate('sim_accept'),
      buildCandidate('sim_needs_mutation'),
      buildCandidate('sim_reject'),
    ])
    const vectorStore = {
      async upsert() {},
      async queryByEmbedding() {
        return [
          { id: 'near_a', distance: 0.35, score: 0.74, metadata: { characterId: 'near_a' } },
          { id: 'near_b', distance: 0.25, score: 0.8, metadata: { characterId: 'near_b' } },
          { id: 'near_c', distance: 0.12, score: 0.9, metadata: { characterId: 'near_c' } },
        ]
      },
    }
    const embeddingProvider = {
      idx: 0,
      async embedText() {
        const vectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        const out = vectors[this.idx] || [1, 1, 1]
        this.idx += 1
        return out
      },
    }
    vectorStore.queryByEmbedding = async ({ embedding }) => {
      if (embedding[0] === 1) return [{ id: 'near_a', distance: 0.35, score: 0.74, metadata: { characterId: 'near_a' } }]
      if (embedding[1] === 1) return [{ id: 'near_b', distance: 0.25, score: 0.8, metadata: { characterId: 'near_b' } }]
      return [{ id: 'near_c', distance: 0.12, score: 0.9, metadata: { characterId: 'near_c' } }]
    }

    const result = await runBatchCharacterGeneration({
      db,
      vectorStore,
      embeddingProvider,
      llmGenerate,
      input: { request: { ...validCharacterGenerationRequest, count: 3, candidateMultiplier: 1 } },
    })

    expect(result.summary.accepted).toBe(1)
    expect(result.summary.needsMutation).toBe(1)
    expect(result.summary.rejected).toBe(1)
    db.close()
  })

  it('saveAccepted inserts accepted only', async () => {
    const db = createTempDb()
    createCharacter(db, buildCandidate('existing_1'))
    const llmGenerate = async () => JSON.stringify([
      buildCandidate('save_accept'),
      buildCandidate('save_reject'),
    ])
    const vectorStore = {
      async upsert() {},
      async queryByEmbedding({ embedding }) {
        if (embedding[0] > 0.5) return [{ id: 'x', distance: 0.35, score: 0.74, metadata: { characterId: 'x' } }]
        return [{ id: 'y', distance: 0.1, score: 0.9, metadata: { characterId: 'y' } }]
      },
    }
    const embeddingProvider = {
      idx: 0,
      async embedText() {
        this.idx += 1
        return this.idx === 1 ? [1, 0, 0] : [0, 1, 0]
      },
    }
    const result = await runBatchCharacterGeneration({
      db,
      vectorStore,
      embeddingProvider,
      llmGenerate,
      input: {
        request: { ...validCharacterGenerationRequest, count: 2, candidateMultiplier: 1 },
        options: { saveAccepted: true, checkSimilarity: true },
      },
    })
    const all = listCharacters(db)
    expect(result.summary.saved).toBe(1)
    expect(all.some((item) => item.id === 'save_accept')).toBe(true)
    expect(all.some((item) => item.id === 'save_reject')).toBe(false)
    db.close()
  })
})
