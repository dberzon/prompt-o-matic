import { apiGet, apiPost } from './http.js'

export function listEntityAttributes(entityId, query = {}) {
  return apiGet(`/api/entities/${encodeURIComponent(entityId)}/attributes`, query)
}

export function promoteEntityAttribute(entityId, attributeId) {
  return apiPost(`/api/entities/${encodeURIComponent(entityId)}/attributes/${encodeURIComponent(attributeId)}/promote`, {})
}

export function dismissEntityAttribute(entityId, attributeId) {
  return apiPost(`/api/entities/${encodeURIComponent(entityId)}/attributes/${encodeURIComponent(attributeId)}/dismiss`, {})
}

export function editEntityAttribute(entityId, attributeId, value) {
  return apiPost(`/api/entities/${encodeURIComponent(entityId)}/attributes/${encodeURIComponent(attributeId)}/edit`, { value })
}
