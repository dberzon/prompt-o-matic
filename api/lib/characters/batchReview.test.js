import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import {
  getCharacter,
  getCharacterBatch,
  listBatchCandidates,
} from '../db/repositories.js'
import { validCharacterProfile } from './fixtures.js'
import {
  approveCandidate,
  listCandidatesForBatch,
  mutateBatchCandidate,
  persistBatchFromGeneration,
  recalculateCharacterBatchSummary,
  rejectCandidate,
  refillCharacterBatch,
  saveCandidateAsCharacter,
} from './batchReview.js'
import { createMockEmbeddingProvider } from '../embeddings/mockEmbeddingProvider.js'
import { createMockVectorStore } from '../vector/mockVectorStore.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-batch-review-test-'))
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

function makeGenerationResult() {
  return {
    request: { count: 2, ageMin: 20, ageMax: 28, outputViews: ['front_portrait'], candidateMultiplier: 1, diversityRequirements: [] },
    options: { persistBatch: true, saveAccepted: false, checkSimilarity: true, mutateSimilar: false, similarityLimit: 5, maxCandidates: 2 },
    provider: { engine: 'local', localProvider: 'mock' },
    summary: { generated: 2, accepted: 1, rejected: 1, needsMutation: 0, saved: 0 },
    accepted: [{ candidate: { ...validCharacterProfile, id: 'cand_ok' }, nearestMatches: [] }],
    rejected: [{ candidate: { ...validCharacterProfile, id: 'cand_bad' }, reason: 'too_similar', nearestMatches: [] }],
    needsMutation: [],
    errors: [],
  }
}

describe('batch review repository/service', () => {
  it('creates batch session and persists candidates', () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const fetched = getCharacterBatch(db, batch.id)
    expect(fetched).not.toBeNull()
    const items = listBatchCandidates(db, batch.id)
    expect(items.length).toBe(2)
    db.close()
  })

  it('lists candidates by filters', () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const accepted = listCandidatesForBatch(db, { batchId: batch.id, classification: 'accepted' })
    const rejected = listCandidatesForBatch(db, { batchId: batch.id, reviewStatus: 'rejected' })
    expect(accepted.length).toBe(1)
    expect(rejected.length).toBe(1)
    db.close()
  })

  it('approves and rejects candidates', () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const candidates = listBatchCandidates(db, batch.id)
    const approved = approveCandidate(db, { candidateId: candidates[0].id })
    const rejected = rejectCandidate(db, { candidateId: candidates[1].id, reason: 'not suitable' })
    expect(approved.reviewStatus).toBe('approved')
    expect(rejected.reviewStatus).toBe('rejected')
    db.close()
  })

  it('saves approved candidate as character', async () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const candidate = listBatchCandidates(db, batch.id).find((item) => item.classification === 'accepted')
    approveCandidate(db, { candidateId: candidate.id })
    const saved = await saveCandidateAsCharacter({ db }, { candidateId: candidate.id })
    expect(saved.reviewStatus).toBe('saved')
    expect(saved.savedCharacterId).toBeTruthy()
    expect(getCharacter(db, saved.savedCharacterId)).not.toBeNull()
    db.close()
  })

  it('rejects invalid candidate save', async () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, {
      ...makeGenerationResult(),
      accepted: [{ candidate: { id: 'broken_candidate' }, nearestMatches: [] }],
      rejected: [],
      summary: { generated: 1, accepted: 1, rejected: 0, needsMutation: 0, saved: 0 },
    })
    const candidate = listBatchCandidates(db, batch.id)[0]
    approveCandidate(db, { candidateId: candidate.id })
    await expect(saveCandidateAsCharacter({ db }, { candidateId: candidate.id })).rejects.toThrow()
    db.close()
  })

  it('mutate candidate creates new candidate and marks original mutated', async () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const source = listBatchCandidates(db, batch.id).find((item) => item.classification === 'accepted')
    const llmGenerate = async () => JSON.stringify({
      ...validCharacterProfile,
      id: 'mutated_candidate_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      embeddingStatus: 'not_indexed',
    })
    const vectorStore = createMockVectorStore()
    const embeddingProvider = createMockEmbeddingProvider()

    const result = await mutateBatchCandidate({
      db,
      candidateId: source.id,
      reason: 'too similar',
      mutationInstructions: 'change face and posture',
      provider: { engine: 'local', localProvider: 'mock' },
      llmGenerate,
      vectorStore,
      embeddingProvider,
    })
    expect(result.ok).toBe(true)
    const items = listBatchCandidates(db, batch.id)
    expect(items.length).toBe(3)
    const original = items.find((i) => i.id === source.id)
    expect(original.reviewStatus).toBe('mutated')
    db.close()
  })

  it('invalid mutated JSON is rejected cleanly', async () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const source = listBatchCandidates(db, batch.id).find((item) => item.classification === 'accepted')
    const llmGenerate = async () => 'not-json'

    await expect(mutateBatchCandidate({
      db,
      candidateId: source.id,
      llmGenerate,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
    })).rejects.toThrow()
    db.close()
  })

  it('refill adds candidates and respects maxNewCandidates', async () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, {
      ...makeGenerationResult(),
      summary: { generated: 1, accepted: 1, rejected: 0, needsMutation: 0, saved: 0 },
      accepted: [{ candidate: { ...validCharacterProfile, id: 'usable_1' }, nearestMatches: [] }],
      rejected: [],
    })

    const llmGenerate = async () => JSON.stringify([
      { ...validCharacterProfile, id: 'refill_1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { ...validCharacterProfile, id: 'refill_2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { ...validCharacterProfile, id: 'refill_3', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ])

    const result = await refillCharacterBatch({
      db,
      batchId: batch.id,
      targetCount: 5,
      maxNewCandidates: 2,
      llmGenerate,
      vectorStore: createMockVectorStore(),
      embeddingProvider: createMockEmbeddingProvider(),
    })
    expect(result.ok).toBe(true)
    expect(result.added).toBe(2)
    db.close()
  })

  it('recalculates batch summary correctly', () => {
    const db = createTempDb()
    const batch = persistBatchFromGeneration(db, makeGenerationResult())
    const items = listBatchCandidates(db, batch.id)
    approveCandidate(db, { candidateId: items.find((i) => i.classification === 'accepted').id })
    const updated = recalculateCharacterBatchSummary({ db, batchId: batch.id })
    expect(updated.summary.byReviewStatus.approved).toBe(1)
    db.close()
  })
})
