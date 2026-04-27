import { characterToEmbeddingText } from '../characters/characterToEmbeddingText.js'
import { getCharacter, updateCharacter } from '../db/repositories.js'

export async function markCharacterEmbeddingStatus(db, id, status) {
  const current = getCharacter(db, id)
  if (!current) return null
  return updateCharacter(db, id, { embeddingStatus: status })
}

export async function indexCharacter({ db, vectorStore, embeddingProvider, character }) {
  const existing = getCharacter(db, character.id)
  if (!existing) {
    const err = new Error('Character must exist in canonical DB before indexing')
    err.status = 400
    throw err
  }

  const embeddingText = characterToEmbeddingText(existing)
  try {
    const embedding = await embeddingProvider.embedText(embeddingText)
    await vectorStore.upsert({
      id: existing.id,
      embedding,
      document: embeddingText,
      metadata: {
        characterId: existing.id,
        projectId: existing.projectId ?? null,
        updatedAt: existing.updatedAt ?? null,
      },
    })
    await markCharacterEmbeddingStatus(db, existing.id, 'embedded')
    return { ok: true, id: existing.id }
  } catch (error) {
    await markCharacterEmbeddingStatus(db, existing.id, 'failed')
    throw error
  }
}

export async function findSimilarCharacters({
  vectorStore,
  embeddingProvider,
  characterOrText,
  limit = 5,
}) {
  const embeddingText = typeof characterOrText === 'string'
    ? characterOrText
    : characterToEmbeddingText(characterOrText)

  const embedding = await embeddingProvider.embedText(embeddingText)
  const matches = await vectorStore.queryByEmbedding({ embedding, limit })

  return matches.map((match) => ({
    characterId: match.metadata?.characterId || match.id,
    distance: match.distance,
    score: match.score,
    metadata: match.metadata || null,
    raw: match.raw ?? match,
  }))
}
