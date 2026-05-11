import { apiPost } from './http.js'

export function resolveEntityConflict(entityId, conflictId, winningAttributeId) {
  return apiPost(
    `/api/entities/${encodeURIComponent(entityId)}/conflicts/${encodeURIComponent(conflictId)}/resolve`,
    { winningAttributeId },
  )
}

export function dismissEntityConflict(entityId, conflictId) {
  return apiPost(
    `/api/entities/${encodeURIComponent(entityId)}/conflicts/${encodeURIComponent(conflictId)}/dismiss`,
    {},
  )
}
