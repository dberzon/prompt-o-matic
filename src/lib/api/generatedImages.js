import { apiGet, apiPost } from './http.js'

export function listGeneratedImages(filters = {}) {
  return apiGet('/api/generated-images', filters)
}

export function approveGeneratedImage(id) {
  return apiPost('/api/generated-image-approve', { id })
}

export function rejectGeneratedImage(id, rejectedReason) {
  return apiPost('/api/generated-image-reject', { id, rejectedReason })
}

