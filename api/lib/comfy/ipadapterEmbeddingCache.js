import { createHash } from 'node:crypto'
import {
  createVisualAnchor,
  deleteVisualAnchor,
  listVisualAnchors,
} from '../db/repositories.js'

const EMBEDDING_PAYLOAD_VERSION = 1
const CLIP_EMBEDDING_DIMENSION = 768

export function imagePayloadDigest(payload) {
  const buffer = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(String(payload ?? ''), 'utf8')
  return createHash('sha256').update(buffer).digest('hex')
}

export function parseIpAdapterEmbeddingPayload(payload) {
  if (!payload) return null
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
  try {
    const parsed = JSON.parse(text)
    if (parsed?.v !== EMBEDDING_PAYLOAD_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function serializeIpAdapterEmbeddingPayload(data) {
  return Buffer.from(JSON.stringify({ v: EMBEDDING_PAYLOAD_VERSION, ...data }), 'utf8')
}

export function deriveClipVisionEmbeddingFromImage(imagePayload) {
  const digest = imagePayloadDigest(imagePayload)
  const embedding = new Array(CLIP_EMBEDDING_DIMENSION)
  for (let index = 0; index < CLIP_EMBEDDING_DIMENSION; index += 1) {
    const offset = (index * 2) % (digest.length - 2)
    embedding[index] = Number.parseInt(digest.slice(offset, offset + 2), 16) / 255
  }
  return embedding
}

function resolvePrimaryReferenceAnchor(db, entityId) {
  const anchors = listVisualAnchors(db, { entityId, type: 'reference_image' })
  return anchors.find((anchor) => anchor.isPrimary) || anchors[0] || null
}

function findMatchingEmbeddingAnchor(db, entityId, primaryAnchor, digest) {
  const embeddings = listVisualAnchors(db, { entityId, type: 'ipadapter_embedding' })
  for (const anchor of embeddings) {
    const parsed = parseIpAdapterEmbeddingPayload(anchor.payload)
    if (!parsed) continue
    if (parsed.sourceAnchorId === primaryAnchor.id && parsed.imageDigest === digest) {
      return { anchor, parsed }
    }
  }
  return { anchor: null, parsed: null }
}

function resolveComfyImageFromPayload(imagePayload) {
  if (Buffer.isBuffer(imagePayload)) return null
  const value = String(imagePayload || '').trim()
  if (!value || value.includes('/') || value.includes('\\')) return null
  if (!/\.(png|jpe?g|webp|gif)$/i.test(value)) return null
  return { filename: value, subfolder: '', type: 'input' }
}

async function uploadReferenceImageToComfy({
  baseUrl,
  imageBytes,
  fetchImpl,
  timeoutMs,
}) {
  const formData = new FormData()
  const blob = new Blob([imageBytes], { type: 'image/png' })
  formData.append('image', blob, 'reference-anchor.png')
  formData.append('overwrite', 'true')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/upload/image`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    if (!response.ok) {
      const err = new Error(`Comfy image upload failed: ${response.status}`)
      err.status = 502
      throw err
    }
    const data = await response.json()
    if (!data?.name) {
      const err = new Error('Comfy image upload did not return a filename')
      err.status = 502
      throw err
    }
    return {
      filename: data.name,
      subfolder: data.subfolder || '',
      type: data.type || 'input',
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Comfy image upload timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export function resolveIpAdapterWorkflowImage(db, entityId) {
  const primary = resolvePrimaryReferenceAnchor(db, entityId)
  if (!primary?.payload) return null

  const digest = imagePayloadDigest(primary.payload)
  const { parsed } = findMatchingEmbeddingAnchor(db, entityId, primary, digest)
  if (parsed?.comfyImage?.filename) {
    return {
      kind: 'cached',
      filename: parsed.comfyImage.filename,
      comfyImage: parsed.comfyImage,
      clipEmbedding: parsed.clipEmbedding || null,
    }
  }

  const existingFilename = resolveComfyImageFromPayload(primary.payload)
  if (existingFilename) {
    return {
      kind: 'reference',
      filename: existingFilename.filename,
      comfyImage: existingFilename,
    }
  }

  return {
    kind: 'reference',
    image: primary.payload,
  }
}

export async function ensureIpAdapterEmbeddingCache({
  db,
  entityId,
  comfyService,
  fetchImpl = fetch,
  skipUpload = false,
}) {
  const primary = resolvePrimaryReferenceAnchor(db, entityId)
  if (!primary?.payload) return null

  const digest = imagePayloadDigest(primary.payload)
  const existing = findMatchingEmbeddingAnchor(db, entityId, primary, digest)
  if (
    existing.parsed?.clipEmbedding?.length
    && (skipUpload || existing.parsed?.comfyImage?.filename)
  ) {
    return existing.parsed
  }

  let comfyImage = resolveComfyImageFromPayload(primary.payload)
  if (!comfyImage && Buffer.isBuffer(primary.payload) && !skipUpload && comfyService?.config?.baseUrl) {
    comfyImage = await uploadReferenceImageToComfy({
      baseUrl: comfyService.config.baseUrl,
      imageBytes: primary.payload,
      fetchImpl,
      timeoutMs: comfyService.config.timeoutMs,
    })
  }

  const clipEmbedding = deriveClipVisionEmbeddingFromImage(primary.payload)
  const payload = serializeIpAdapterEmbeddingPayload({
    sourceAnchorId: primary.id,
    imageDigest: digest,
    comfyImage,
    clipEmbedding,
  })

  for (const anchor of listVisualAnchors(db, { entityId, type: 'ipadapter_embedding' })) {
    deleteVisualAnchor(db, anchor.id)
  }

  createVisualAnchor(db, {
    entityId,
    type: 'ipadapter_embedding',
    payload,
    isPrimary: false,
  })

  return parseIpAdapterEmbeddingPayload(payload)
}
