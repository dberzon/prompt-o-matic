import { apiGet, apiPost } from './http.js'

function entityAnchorsPath(entityId, anchorId, suffix = '') {
  const base = `/api/entities/${encodeURIComponent(entityId)}/anchors`
  if (!anchorId) return `${base}${suffix}`
  return `${base}/${encodeURIComponent(anchorId)}${suffix}`
}

export function listEntityAnchors(entityId, { type } = {}) {
  return apiGet(entityAnchorsPath(entityId), type ? { type } : undefined)
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
