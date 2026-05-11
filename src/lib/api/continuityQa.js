import { apiGet, apiPost } from './http.js'

export function getMvpDoneGateReadiness(entityId) {
  return apiGet(`/api/entities/${encodeURIComponent(entityId)}/mvp-done-gate`)
}

export function getContinuityQaScoringSheet(entityId) {
  return apiGet(`/api/entities/${encodeURIComponent(entityId)}/continuity-qa/scoring-sheet`)
}

export function generateContinuityQa(entityId, options = {}) {
  return apiPost(`/api/entities/${encodeURIComponent(entityId)}/continuity-qa/generate`, options)
}

export function submitContinuityQaScores(entityId, scoringSheet) {
  return apiPost(`/api/entities/${encodeURIComponent(entityId)}/continuity-qa/scores`, { scoringSheet })
}
