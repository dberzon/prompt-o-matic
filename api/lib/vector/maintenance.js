import { z } from 'zod'
import { getCharacter, listCharacters, countCharacters, countCharactersByEmbeddingStatus } from '../db/repositories.js'
import { resolveDbPath } from '../db/sqlite.js'
import { findSimilarCharacters, indexCharacter } from './characterIndexing.js'

const IndexCharacterSchema = z.object({
  id: z.string().trim().min(1),
}).strict()

const ReindexSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  embeddingStatus: z.enum(['not_indexed', 'pending', 'embedded', 'failed']).optional(),
  projectId: z.string().trim().min(1).optional(),
}).strict()

const SimilarByCharacterSchema = z.object({
  id: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(5),
}).strict()

const SimilarByTextSchema = z.object({
  text: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(5),
}).strict()

export function parseIndexCharacterRequest(input) {
  return IndexCharacterSchema.parse(input)
}

export function parseReindexRequest(input) {
  return ReindexSchema.parse(input || {})
}

export function parseSimilarByCharacterRequest(input) {
  return SimilarByCharacterSchema.parse(input)
}

export function parseSimilarByTextRequest(input) {
  return SimilarByTextSchema.parse(input)
}

export async function getVectorStatus({ db, vectorStore, embeddingProvider, env = process.env }) {
  const statusCounts = countCharactersByEmbeddingStatus(db)
  const total = countCharacters(db)

  let chroma = {
    available: false,
    collection: vectorStore?.config?.collectionName || env.CHROMA_COLLECTION_CHARACTERS || 'characters',
  }
  try {
    const checked = await vectorStore.checkAvailability()
    chroma = { ...chroma, available: Boolean(checked?.available) }
  } catch (error) {
    chroma = { ...chroma, available: false, error: error?.message || 'chroma unavailable' }
  }

  let embeddings = {
    available: false,
    provider: 'ollama',
    model: embeddingProvider?.config?.model || env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  }
  try {
    await embeddingProvider.embedText('health-check')
    embeddings = { ...embeddings, available: true }
  } catch (error) {
    embeddings = { ...embeddings, available: false, error: error?.message || 'embedding unavailable' }
  }

  return {
    sqlite: {
      available: true,
      dbPath: resolveDbPath(env),
    },
    chroma,
    embeddings,
    characters: {
      total,
      byEmbeddingStatus: statusCounts,
    },
  }
}

export async function indexCharacterById({ db, vectorStore, embeddingProvider, id }) {
  const payload = parseIndexCharacterRequest({ id })
  await indexCharacter({
    db,
    vectorStore,
    embeddingProvider,
    character: { id: payload.id },
  })
  const updated = getCharacter(db, payload.id)
  return {
    ok: true,
    id: payload.id,
    embeddingStatus: updated?.embeddingStatus || null,
  }
}

export async function reindexCharacters({
  db,
  vectorStore,
  embeddingProvider,
  filters,
}) {
  const parsed = parseReindexRequest(filters || {})
  const targets = listCharacters(db, {
    projectId: parsed.projectId,
    embeddingStatus: parsed.embeddingStatus,
    limit: parsed.limit,
  })

  const failures = []
  let succeeded = 0

  for (const character of targets) {
    try {
      await indexCharacter({
        db,
        vectorStore,
        embeddingProvider,
        character: { id: character.id },
      })
      succeeded += 1
    } catch (error) {
      failures.push({
        id: character.id,
        error: error?.message || 'indexing failed',
      })
    }
  }

  return {
    ok: true,
    processed: targets.length,
    succeeded,
    failed: failures.length,
    failures,
  }
}

export async function findSimilarCharactersById({
  db,
  vectorStore,
  embeddingProvider,
  id,
  limit = 5,
}) {
  const parsed = parseSimilarByCharacterRequest({ id, limit })
  const character = getCharacter(db, parsed.id)
  if (!character) {
    const err = new Error('Character not found')
    err.status = 404
    throw err
  }
  const results = await findSimilarCharacters({
    vectorStore,
    embeddingProvider,
    characterOrText: character,
    limit: parsed.limit,
  })
  return {
    ok: true,
    id: parsed.id,
    results,
  }
}

export async function findSimilarCharactersByText({
  vectorStore,
  embeddingProvider,
  text,
  limit = 5,
}) {
  const parsed = parseSimilarByTextRequest({ text, limit })
  const results = await findSimilarCharacters({
    vectorStore,
    embeddingProvider,
    characterOrText: parsed.text,
    limit: parsed.limit,
  })
  return {
    ok: true,
    results,
  }
}
