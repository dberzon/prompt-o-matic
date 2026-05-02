import { apiGet, apiPost } from './http.js'

export function listCharacterBatches() {
  return apiGet('/api/character-batches')
}

export function listCharacters(query = {}) {
  return apiGet('/api/characters', query)
}

export function getCharacterBatch(id) {
  return apiGet('/api/character-batch', { id })
}

export function listBatchCandidates(batchId) {
  return apiGet('/api/character-batch-candidates', { batchId })
}

export function approveBatchCandidate(candidateId) {
  return apiPost('/api/character-batch-candidate-approve', { candidateId })
}

export function rejectBatchCandidate(candidateId, reason) {
  return apiPost('/api/character-batch-candidate-reject', { candidateId, reason })
}

export function saveBatchCandidate(candidateId) {
  return apiPost('/api/character-batch-candidate-save', { candidateId })
}

export function generateBatch({ request, options = {}, provider = {} } = {}) {
  return apiPost('/api/characters-generate-batch', { request, options: { persistBatch: true, ...options }, provider })
}

