import { apiGet, apiPost } from './http.js'

function entityAnchorsPath(entityId, anchorId, suffix = '') {
  const base = `/api/entities/${encodeURIComponent(entityId)}/anchors`
  if (!anchorId) return `${base}${suffix}`
  return `${base}/${encodeURIComponent(anchorId)}${suffix}`
}

async function postForm(path, formData) {
  const response = await fetch(path, {
    method: 'POST',
    body: formData,
  })
  let data = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}`)
    error.status = response.status
    error.code = data?.code || 'API_ERROR'
    error.payload = data
    throw error
  }
  return data
}

export function listEntityAnchors(entityId, { type } = {}) {
  return apiGet(entityAnchorsPath(entityId), type ? { type } : undefined)
}

export function uploadEntityReferenceAnchor(entityId, file, { isPrimary = true } = {}) {
  const formData = new FormData()
  formData.append('type', 'reference_image')
  formData.append('file', file)
  if (isPrimary) formData.append('isPrimary', 'true')
  return postForm(entityAnchorsPath(entityId), formData)
}

export function setPrimaryEntityAnchor(entityId, anchorId) {
  return apiPost(`${entityAnchorsPath(entityId, anchorId)}/set-primary`, {})
}

export function generateReferenceImageFromStage5(entityId, options = {}) {
  return apiPost(`/api/entities/${encodeURIComponent(entityId)}/extrapolate/stage/5`, options)
}

export async function waitForPrimaryReferenceAnchor(entityId, {
  attempts = 30,
  intervalMs = 1000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await listEntityAnchors(entityId, { type: 'reference_image' })
    const items = Array.isArray(result?.items) ? result.items : []
    const primary = items.find((item) => item.isPrimary)
    if (primary) return primary
    await sleep(intervalMs)
  }
  const err = new Error('Timed out waiting for primary reference anchor')
  err.status = 504
  throw err
}
