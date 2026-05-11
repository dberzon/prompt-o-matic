import { characterToEmbeddingText } from '../characters/characterToEmbeddingText.js'
import { getCharacter, getEntity, updateCharacter } from '../db/repositories.js'

export async function markCharacterEmbeddingStatus(db, id, status) {
  const current = getCharacter(db, id)
  if (!current) return null
  return updateCharacter(db, id, { embeddingStatus: status })
}

export function entityToEmbeddingText(entity, attributes = []) {
  const parts = [
    entity?.type || 'entity',
    entity?.name || entity?.id || '',
  ]
  for (const attribute of attributes) {
    if (!attribute?.key) continue
    const value = attribute.value === null || attribute.value === undefined
      ? ''
      : (typeof attribute.value === 'string' ? attribute.value : JSON.stringify(attribute.value))
    if (value) parts.push(`${attribute.key}: ${value}`)
  }
  return parts.filter(Boolean).join(' | ')
}

export async function indexEntity({
  db,
  vectorStore,
  embeddingProvider,
  entityId,
  entityType,
  embeddingText,
  projectId = null,
  updatedAt = null,
  markEmbedded,
}) {
  const entity = getEntity(db, entityId)
  if (!entity) {
    const err = new Error('Entity must exist in canonical DB before indexing')
    err.status = 400
    throw err
  }
  const resolvedType = entityType || entity.type
  const document = embeddingText || entityToEmbeddingText(entity)
  try {
    const embedding = await embeddingProvider.embedText(document)
    await vectorStore.upsert({
      id: entity.id,
      embedding,
      document,
      metadata: {
        entityId: entity.id,
        entityType: resolvedType,
        characterId: resolvedType === 'character' ? entity.id : null,
        projectId,
        updatedAt: updatedAt || entity.updatedAt || null,
      },
    })
    if (typeof markEmbedded === 'function') {
      await markEmbedded(db, entity.id)
    }
    return { ok: true, id: entity.id, entityType: resolvedType }
  } catch (error) {
    if (typeof markEmbedded === 'function') {
      try {
        await markEmbedded(db, entity.id, 'failed')
      } catch {}
    }
    throw error
  }
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
        entityId: existing.id,
        entityType: 'character',
        characterId: existing.id,
        projectId: existing.projectId ?? null,
        updatedAt: existing.updatedAt ?? null,
      },
    })
    await markCharacterEmbeddingStatus(db, existing.id, 'embedded')
    return { ok: true, id: existing.id, entityType: 'character' }
  } catch (error) {
    await markCharacterEmbeddingStatus(db, existing.id, 'failed')
    throw error
  }
}

export async function findSimilarEntities({
  vectorStore,
  embeddingProvider,
  entityOrText,
  entityType,
  limit = 5,
}) {
  const embeddingText = typeof entityOrText === 'string'
    ? entityOrText
    : characterToEmbeddingText(entityOrText)

  const embedding = await embeddingProvider.embedText(embeddingText)
  const matches = await vectorStore.queryByEmbedding({ embedding, limit, entityType })

  return matches.map((match) => ({
    entityId: match.metadata?.entityId || match.id,
    entityType: match.metadata?.entityType || null,
    characterId: match.metadata?.characterId || match.metadata?.entityId || match.id,
    distance: match.distance,
    score: match.score,
    metadata: match.metadata || null,
    raw: match.raw ?? match,
  }))
}

export async function findSimilarCharacters({
  vectorStore,
  embeddingProvider,
  characterOrText,
  limit = 5,
}) {
  return findSimilarEntities({
    vectorStore,
    embeddingProvider,
    entityOrText: characterOrText,
    entityType: 'character',
    limit,
  })
}
