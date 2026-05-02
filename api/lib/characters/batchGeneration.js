import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { parseCharacterGenerationRequest, parseCharacterProfile } from './schemas.js'
import { parseJsonFromLlmText } from './jsonUtils.js'
import { buildBatchCandidateGenerationPrompt, buildMutationPrompt } from './prompts.js'
import { findSimilarCharacters } from '../vector/characterIndexing.js'
import { createCharacter } from '../db/repositories.js'

const BatchInputSchema = z.object({
  request: z.unknown(),
  options: z.object({
    persistBatch: z.boolean().default(false),
    saveAccepted: z.boolean().default(false),
    checkSimilarity: z.boolean().default(true),
    mutateSimilar: z.boolean().default(false),
    similarityLimit: z.number().int().min(1).max(20).default(5),
    maxCandidates: z.number().int().min(1).max(200).optional(),
  }).default({}),
  provider: z.object({
    engine: z.enum(['auto', 'local', 'cloud', 'embedded']).default('auto'),
    localProvider: z.enum(['ollama', 'lmstudio', 'mock']).optional(),
    model: z.string().trim().min(1).optional(),
  }).default({}),
}).strict()

const DEFAULT_THRESHOLDS = {
  hardRejectDistance: 0.18,
  needsMutationDistance: 0.28,
}

function normalizeBatchInput(input) {
  const parsed = BatchInputSchema.parse(input)
  const request = parseCharacterGenerationRequest(parsed.request)
  const options = {
    persistBatch: parsed.options.persistBatch ?? false,
    saveAccepted: parsed.options.saveAccepted ?? false,
    checkSimilarity: parsed.options.checkSimilarity ?? true,
    mutateSimilar: parsed.options.mutateSimilar ?? false,
    similarityLimit: parsed.options.similarityLimit ?? 5,
    maxCandidates: parsed.options.maxCandidates ?? request.count * request.candidateMultiplier,
  }
  const provider = {
    engine: parsed.provider.engine ?? 'auto',
    localProvider: parsed.provider.localProvider,
    model: parsed.provider.model,
  }
  return { request, options, provider }
}

function normalizeCandidateProfile(candidate, request, nowIso = new Date().toISOString()) {
  const raw = candidate && typeof candidate === 'object' ? candidate : {}
  const apparent = raw.apparentAgeRange && typeof raw.apparentAgeRange === 'object'
    ? raw.apparentAgeRange
    : { min: request.ageMin, max: request.ageMax }
  // Non-Qwen models emit qwenPromptSeed as a number; coerce to string or drop.
  const rawSeed = raw.qwenPromptSeed
  const qwenPromptSeed = typeof rawSeed === 'string' && rawSeed.trim()
    ? rawSeed
    : typeof rawSeed === 'number'
      ? String(rawSeed)
      : undefined
  return {
    ...raw,
    id: raw.id || randomUUID(),
    age: Number.isFinite(raw.age) ? raw.age : request.ageMin,
    apparentAgeRange: {
      min: Number.isFinite(apparent.min) ? apparent.min : request.ageMin,
      max: Number.isFinite(apparent.max) ? apparent.max : request.ageMax,
    },
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || nowIso,
    embeddingStatus: raw.embeddingStatus || 'not_indexed',
    ...(qwenPromptSeed !== undefined ? { qwenPromptSeed } : { qwenPromptSeed: undefined }),
  }
}

function classifyBySimilarity(bestDistance, thresholds = DEFAULT_THRESHOLDS) {
  if (typeof bestDistance !== 'number') return 'accepted'
  if (bestDistance <= thresholds.hardRejectDistance) return 'rejected'
  if (bestDistance <= thresholds.needsMutationDistance) return 'needsMutation'
  return 'accepted'
}

async function maybeMutateCandidate({ candidate, nearestMatches, llmGenerate, providerPayload }) {
  const userMessage = buildMutationPrompt({ candidate, nearestMatches })
  const responseText = await llmGenerate({
    system: 'Return strict JSON object only.',
    user: userMessage,
    providerPayload,
  })
  const parsed = parseJsonFromLlmText(responseText)
  return parsed
}

export async function runBatchCharacterGeneration({
  db,
  vectorStore,
  embeddingProvider,
  llmGenerate,
  input,
  thresholds = DEFAULT_THRESHOLDS,
}) {
  const { request, options, provider } = normalizeBatchInput(input)
  const totalCandidates = Math.min(request.count * request.candidateMultiplier, options.maxCandidates)

  const generationPrompt = buildBatchCandidateGenerationPrompt({ request, totalCandidates })
  const llmOutputText = await llmGenerate({
    system: 'You are a strict JSON generator. Return JSON only.',
    user: generationPrompt,
    providerPayload: {
      engine: provider.engine,
      localProvider: provider.localProvider,
      model: provider.model,
      responseFormat: 'json',
    },
  })

  const parsedPayload = parseJsonFromLlmText(llmOutputText)
  const rawCandidates = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload]

  const accepted = []
  const rejected = []
  const needsMutation = []
  const errors = []
  let saved = 0

  for (const rawCandidate of rawCandidates) {
    let candidate = normalizeCandidateProfile(rawCandidate, request)
    try {
      candidate = parseCharacterProfile(candidate)
    } catch (error) {
      rejected.push({ candidate: rawCandidate, reason: 'schema_invalid' })
      errors.push({ type: 'schema', message: error?.message || 'Invalid candidate schema' })
      continue
    }

    let nearestMatches = []
    let bestDistance = null
    if (options.checkSimilarity && vectorStore && embeddingProvider) {
      try {
        nearestMatches = await findSimilarCharacters({
          vectorStore,
          embeddingProvider,
          characterOrText: candidate,
          limit: options.similarityLimit,
        })
        bestDistance = nearestMatches.length ? nearestMatches[0].distance : null
      } catch (error) {
        errors.push({ type: 'similarity', candidateId: candidate.id, message: error?.message || 'Similarity check failed' })
      }
    }

    let classification = classifyBySimilarity(bestDistance, thresholds)

    if (classification === 'needsMutation' && options.mutateSimilar) {
      try {
        const mutatedRaw = await maybeMutateCandidate({
          candidate,
          nearestMatches,
          llmGenerate,
          providerPayload: {
            engine: provider.engine,
            localProvider: provider.localProvider,
            model: provider.model,
          },
        })
        const mutated = parseCharacterProfile(normalizeCandidateProfile(mutatedRaw, request))
        candidate = mutated
        classification = 'accepted'
      } catch (error) {
        errors.push({ type: 'mutation', candidateId: candidate.id, message: error?.message || 'Mutation failed' })
      }
    }

    if (classification === 'rejected') {
      rejected.push({ candidate, reason: 'too_similar', nearestMatches })
      continue
    }
    if (classification === 'needsMutation') {
      needsMutation.push({ candidate, reason: 'possible_similarity', nearestMatches })
      continue
    }

    accepted.push({ candidate, nearestMatches })
  }

  let acceptedToSave = accepted
  if (acceptedToSave.length > request.count) {
    acceptedToSave = acceptedToSave.slice(0, request.count)
  }

  if (options.saveAccepted && db) {
    for (const item of acceptedToSave) {
      createCharacter(db, {
        ...item.candidate,
        embeddingStatus: 'not_indexed',
      })
      saved += 1
    }
  }

  return {
    request,
    options,
    provider,
    summary: {
      generated: rawCandidates.length,
      accepted: acceptedToSave.length,
      rejected: rejected.length,
      needsMutation: needsMutation.length,
      saved,
    },
    accepted: acceptedToSave,
    rejected,
    needsMutation,
    errors,
  }
}
