import { apiGet } from './http.js'

export function listEntities(query = {}) {
  return apiGet('/api/entities', query)
}

export function getEntity(entityId) {
  return apiGet(`/api/entities/${encodeURIComponent(entityId)}`)
}
