import { updateCharacter } from './db/repositories.js'
import { indexCharacterById } from './vector/maintenance.js'

function set(db, characterId, lifecycleStatus) {
  const updated = updateCharacter(db, characterId, { lifecycleStatus })
  if (!updated) {
    const err = new Error(`Character not found: ${characterId}`)
    err.status = 404
    throw err
  }
  return updated
}

export function setAuditioned(db, characterId) {
  return set(db, characterId, 'auditioned')
}

export function setPreview(db, characterId) {
  return set(db, characterId, 'preview')
}

export function setPortfolioPending(db, characterId) {
  return set(db, characterId, 'portfolio_pending')
}

export function setPortfolioFailed(db, characterId) {
  return set(db, characterId, 'portfolio_failed')
}

export function setReady(db, characterId) {
  return set(db, characterId, 'ready')
}

export async function triggerReindex(db, characterId, { vectorStore, embeddingProvider }) {
  return indexCharacterById({ db, vectorStore, embeddingProvider, id: characterId })
}
