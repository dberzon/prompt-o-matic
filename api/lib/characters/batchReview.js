import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { parseJsonFromLlmText } from './jsonUtils.js'
import { buildMutationPrompt } from './prompts.js'
import { parseCharacterProfile } from './schemas.js'
import { findSimilarCharacters } from '../vector/characterIndexing.js'
import { triggerReindex } from '../characterLifecycle.js'
import { runBatchCharacterGeneration } from './batchGeneration.js'
import {
  approveBatchCandidate,
  createBatchCandidate,
  createCharacterBatch,
  getBatchCandidate,
  getCharacterBatch,
  listBatchCandidates,
  listCharacterBatches,
  rejectBatchCandidate,
  saveApprovedCandidateAsCharacter,
  updateCharacterBatch,
  updateBatchCandidate,
} from '../db/repositories.js'

const CandidateActionSchema = z.object({
  candidateId: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional(),
  force: z.boolean().optional(),
}).strict()

const ListCandidatesQuerySchema = z.object({
  batchId: z.string().trim().min(1),
  classification: z.enum(['accepted', 'rejected', 'needsMutation', 'pendingReview']).optional(),
  reviewStatus: z.enum(['pending', 'approved', 'rejected', 'mutated', 'saved']).optional(),
}).strict()

export function persistBatchFromGeneration(db, generationResult) {
  const batch = createCharacterBatch(db, {
    id: `batch_${randomUUID()}`,
    request: generationResult.request,
    options: generationResult.options,
    provider: generationResult.provider,
    summary: generationResult.summary,
    status: generationResult.summary.rejected > 0 || generationResult.summary.needsMutation > 0
      ? 'generated'
      : 'partially_reviewed',
  })

  for (const item of generationResult.accepted || []) {
    createBatchCandidate(db, {
      batchId: batch.id,
      candidate: item.candidate,
      classification: 'accepted',
      reviewStatus: 'pending',
      similarity: item.nearestMatches || [],
      errors: null,
    })
  }
  for (const item of generationResult.rejected || []) {
    createBatchCandidate(db, {
      batchId: batch.id,
      candidate: item.candidate,
      classification: 'rejected',
      reviewStatus: 'rejected',
      similarity: item.nearestMatches || [],
      errors: item.reason ? [{ reason: item.reason }] : null,
      reviewNote: item.reason || null,
    })
  }
  for (const item of generationResult.needsMutation || []) {
    createBatchCandidate(db, {
      batchId: batch.id,
      candidate: item.candidate,
      classification: 'needsMutation',
      reviewStatus: 'pending',
      similarity: item.nearestMatches || [],
      errors: item.reason ? [{ reason: item.reason }] : null,
    })
  }
  return batch
}

function computeDerivedFields(db, batchId) {
  const items = listBatchCandidates(db, batchId)
  const summary = {
    totalCandidates: items.length,
    byClassification: { accepted: 0, rejected: 0, needsMutation: 0, pendingReview: 0 },
    byReviewStatus: { pending: 0, approved: 0, rejected: 0, mutated: 0, saved: 0 },
    usableCount: 0,
  }
  for (const item of items) {
    if (item.classification in summary.byClassification) summary.byClassification[item.classification] += 1
    if (item.reviewStatus in summary.byReviewStatus) summary.byReviewStatus[item.reviewStatus] += 1
    if (item.reviewStatus === 'approved' || item.reviewStatus === 'saved' || (item.classification === 'accepted' && item.reviewStatus === 'pending')) {
      summary.usableCount += 1
    }
  }
  const pending = summary.byReviewStatus.pending
  const status = items.length === 0 ? 'generated' : pending > 0 ? 'partially_reviewed' : 'completed'
  return { summary, status }
}

export function recalculateCharacterBatchSummary({ db, batchId }) {
  const batch = getCharacterBatch(db, batchId)
  if (!batch) return null
  const { summary, status } = computeDerivedFields(db, batchId)
  return updateCharacterBatch(db, batchId, { summary, status })
}

export function listBatches(db, filters = {}) {
  const batches = listCharacterBatches(db, filters)
  return batches.map((batch) => {
    const { summary, status } = computeDerivedFields(db, batch.id)
    return { ...batch, summary, status }
  })
}

export function getBatch(db, id) {
  const batch = getCharacterBatch(db, id)
  if (!batch) return null
  const { summary, status } = computeDerivedFields(db, id)
  return { ...batch, summary, status }
}

export function listCandidatesForBatch(db, query) {
  const parsed = ListCandidatesQuerySchema.parse(query)
  return listBatchCandidates(db, parsed.batchId, {
    classification: parsed.classification,
    reviewStatus: parsed.reviewStatus,
  })
}

export function approveCandidate(db, payload) {
  const parsed = CandidateActionSchema.parse(payload)
  return approveBatchCandidate(db, parsed.candidateId)
}

export function rejectCandidate(db, payload) {
  const parsed = CandidateActionSchema.parse(payload)
  return rejectBatchCandidate(db, parsed.candidateId, parsed.reason || null)
}

export async function saveCandidateAsCharacter({ db, vectorStore, embeddingProvider }, payload) {
  const parsed = CandidateActionSchema.parse(payload)

  if (!parsed.force && vectorStore && embeddingProvider) {
    const candidateRecord = getBatchCandidate(db, parsed.candidateId)
    if (candidateRecord?.candidate) {
      try {
        const results = await findSimilarCharacters({
          vectorStore,
          embeddingProvider,
          characterOrText: candidateRecord.candidate,
          limit: 3,
        })
        const similar = results.filter((r) => typeof r.distance === 'number' && r.distance <= 0.28)
        if (similar.length > 0) {
          return { warning: 'similar_character_found', matches: similar }
        }
      } catch {
        // vector store unavailable — skip check and proceed
      }
    }
  }

  const updated = saveApprovedCandidateAsCharacter(db, parsed.candidateId)
  if (!updated) return null
  recalculateCharacterBatchSummary({ db, batchId: updated.batchId })

  if (vectorStore && embeddingProvider && updated.savedCharacterId) {
    triggerReindex(db, updated.savedCharacterId, { vectorStore, embeddingProvider }).catch(() => {})
  }

  return updated
}

const MutateRequestSchema = z.object({
  candidateId: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional(),
  mutationInstructions: z.string().trim().min(1).optional(),
  provider: z.object({
    engine: z.enum(['auto', 'local', 'cloud', 'embedded']).optional(),
    localProvider: z.enum(['ollama', 'lmstudio', 'mock']).optional(),
    model: z.string().trim().min(1).optional(),
  }).optional(),
}).strict()

const RefillRequestSchema = z.object({
  batchId: z.string().trim().min(1),
  targetCount: z.number().int().min(1).max(100).optional(),
  maxNewCandidates: z.number().int().min(1).max(100).default(20),
  provider: z.object({
    engine: z.enum(['auto', 'local', 'cloud', 'embedded']).optional(),
    localProvider: z.enum(['ollama', 'lmstudio', 'mock']).optional(),
    model: z.string().trim().min(1).optional(),
  }).optional(),
  options: z.object({
    checkSimilarity: z.boolean().default(true),
    mutateSimilar: z.boolean().default(false),
  }).default({}),
}).strict()

function classifyByDistance(distance) {
  if (typeof distance !== 'number') return 'accepted'
  if (distance <= 0.18) return 'rejected'
  if (distance <= 0.28) return 'needsMutation'
  return 'accepted'
}

export async function mutateBatchCandidate({
  db,
  candidateId,
  reason,
  mutationInstructions,
  provider,
  llmGenerate,
  vectorStore,
  embeddingProvider,
}) {
  const parsed = MutateRequestSchema.parse({ candidateId, reason, mutationInstructions, provider })
  const source = getBatchCandidate(db, parsed.candidateId)
  if (!source) {
    const err = new Error('Candidate not found')
    err.status = 404
    throw err
  }
  const batch = getCharacterBatch(db, source.batchId)
  if (!batch) {
    const err = new Error('Parent batch not found')
    err.status = 404
    throw err
  }

  const prompt = buildMutationPrompt({
    candidate: source.candidate,
    nearestMatches: source.similarity || [],
  }) + `\n\nReason: ${parsed.reason || 'Needs variation'}\nInstructions: ${parsed.mutationInstructions || 'Change facial structure, hair, posture, archetype and distinctive features.'}`

  const text = await llmGenerate({
    system: 'Return strict JSON object only matching CharacterProfile schema.',
    user: prompt,
    providerPayload: {
      engine: parsed.provider?.engine || batch.provider?.engine || 'auto',
      localProvider: parsed.provider?.localProvider || batch.provider?.localProvider,
      model: parsed.provider?.model || batch.provider?.model,
    },
  })

  const raw = parseJsonFromLlmText(text)
  const now = new Date().toISOString()
  const normalized = parseCharacterProfile({
    ...raw,
    id: raw.id || `cand_${randomUUID()}`,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    embeddingStatus: 'not_indexed',
  })

  let nearestMatches = []
  let classification = 'accepted'
  if (vectorStore && embeddingProvider && batch.options?.checkSimilarity !== false) {
    nearestMatches = await findSimilarCharacters({
      vectorStore,
      embeddingProvider,
      characterOrText: normalized,
      limit: batch.options?.similarityLimit || 5,
    })
    classification = classifyByDistance(nearestMatches[0]?.distance)
  }

  const created = createBatchCandidate(db, {
    batchId: source.batchId,
    sourceCandidateId: source.id,
    candidate: normalized,
    classification,
    reviewStatus: 'pending',
    similarity: nearestMatches,
    mutation: {
      reason: parsed.reason || null,
      mutationInstructions: parsed.mutationInstructions || null,
      provider: parsed.provider || null,
      sourceCandidateId: source.id,
    },
    generationRound: (source.generationRound || 1) + 1,
  })

  updateBatchCandidate(db, source.id, {
    reviewStatus: 'mutated',
    reviewNote: parsed.reason || 'mutated',
  })
  const batchAfter = recalculateCharacterBatchSummary({ db, batchId: source.batchId })
  return {
    ok: true,
    originalCandidateId: source.id,
    mutatedCandidateId: created.id,
    classification: created.classification,
    reviewStatus: created.reviewStatus,
    batchSummary: batchAfter?.summary || null,
  }
}

export async function refillCharacterBatch({
  db,
  batchId,
  targetCount,
  maxNewCandidates,
  provider,
  options,
  llmGenerate,
  vectorStore,
  embeddingProvider,
}) {
  const parsed = RefillRequestSchema.parse({
    batchId,
    targetCount,
    maxNewCandidates,
    provider,
    options,
  })
  const batch = getCharacterBatch(db, parsed.batchId)
  if (!batch) {
    const err = new Error('Batch not found')
    err.status = 404
    throw err
  }

  const refreshed = recalculateCharacterBatchSummary({ db, batchId: parsed.batchId }) || batch
  const target = parsed.targetCount || batch.request?.count || 1
  const usable = refreshed.summary?.usableCount || 0
  const needed = Math.max(0, target - usable)
  const toGenerate = Math.min(needed, parsed.maxNewCandidates)

  if (toGenerate <= 0) {
    return {
      ok: true,
      batchId: parsed.batchId,
      added: 0,
      summary: refreshed.summary,
      batchStatus: refreshed.status,
      failures: [],
    }
  }

  const generated = await runBatchCharacterGeneration({
    db,
    vectorStore,
    embeddingProvider,
    llmGenerate,
    input: {
      request: {
        ...batch.request,
        count: toGenerate,
        candidateMultiplier: 1,
      },
      options: {
        ...batch.options,
        ...parsed.options,
        persistBatch: false,
        saveAccepted: false,
        maxCandidates: toGenerate,
      },
      provider: {
        ...batch.provider,
        ...(parsed.provider || {}),
      },
    },
  })

  let added = 0
  const round = (listBatchCandidates(db, parsed.batchId).reduce((m, i) => Math.max(m, i.generationRound || 1), 1)) + 1
  for (const item of generated.accepted || []) {
    createBatchCandidate(db, {
      batchId: parsed.batchId,
      candidate: item.candidate,
      classification: 'accepted',
      reviewStatus: 'pending',
      similarity: item.nearestMatches || [],
      generationRound: round,
      mutation: { refill: true },
    })
    added += 1
  }
  for (const item of generated.needsMutation || []) {
    createBatchCandidate(db, {
      batchId: parsed.batchId,
      candidate: item.candidate,
      classification: 'needsMutation',
      reviewStatus: 'pending',
      similarity: item.nearestMatches || [],
      generationRound: round,
      errors: item.reason ? [{ reason: item.reason }] : null,
      mutation: { refill: true },
    })
    added += 1
  }
  for (const item of generated.rejected || []) {
    createBatchCandidate(db, {
      batchId: parsed.batchId,
      candidate: item.candidate,
      classification: 'rejected',
      reviewStatus: 'rejected',
      similarity: item.nearestMatches || [],
      generationRound: round,
      errors: item.reason ? [{ reason: item.reason }] : null,
      reviewNote: item.reason || null,
      mutation: { refill: true },
    })
    added += 1
  }

  const updatedBatch = recalculateCharacterBatchSummary({ db, batchId: parsed.batchId })
  return {
    ok: true,
    batchId: parsed.batchId,
    added,
    summary: updatedBatch?.summary || null,
    batchStatus: updatedBatch?.status || null,
    failures: generated.errors || [],
  }
}

export function getBatchCandidateById(db, candidateId) {
  return getBatchCandidate(db, candidateId)
}
