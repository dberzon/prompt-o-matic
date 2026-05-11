import { apiGet, apiPost } from './http.js'

export function listEntities(query = {}) {
  return apiGet('/api/entities', query)
}

export function getEntity(entityId) {
  return apiGet(`/api/entities/${encodeURIComponent(entityId)}`)
}

export function liftEntityFromBankEntry({ slug, name, description, optimizedDescription }) {
  return apiPost('/api/entities/lift-from-bank-entry', {
    slug,
    name,
    description,
    optimizedDescription,
  })
}
