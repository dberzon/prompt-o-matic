import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { getGeneratedImageRecord } from './lib/db/repositories.js'
import { assertGeneratedImagesOperationAllowed } from './lib/generatedImages/access.js'

export function resolveComfyImageInfo(record) {
  const fromPayload = record?.comfyImage
  if (fromPayload?.filename) {
    return {
      filename: fromPayload.filename,
      subfolder: fromPayload.subfolder || '',
      type: fromPayload.type || 'output',
    }
  }
  const imagePath = typeof record?.imagePath === 'string' ? record.imagePath.trim() : ''
  if (!imagePath) return null
  const parts = imagePath.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length === 0) return null
  return {
    filename: parts[parts.length - 1],
    subfolder: parts.slice(0, -1).join('/'),
    type: 'output',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertGeneratedImagesOperationAllowed('view', process.env)
    const id = typeof req.query?.id === 'string' ? req.query.id : ''
    if (!id) return sendJsonNode(res, 400, { error: 'Missing id' })
    runtime = createVectorRuntime({ env: process.env })
    const record = getGeneratedImageRecord(runtime.db, id)
    if (!record) return sendJsonNode(res, 404, { error: 'Generated image not found' })
    const info = resolveComfyImageInfo(record)
    if (!info?.filename) {
      return sendJsonNode(res, 400, { error: 'Could not resolve Comfy image metadata for this record.' })
    }
    const baseUrl = (process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '')
    const viewUrl = new URL(`${baseUrl}/view`)
    viewUrl.searchParams.set('filename', info.filename)
    viewUrl.searchParams.set('subfolder', info.subfolder || '')
    viewUrl.searchParams.set('type', info.type || 'output')
    const response = await fetch(viewUrl.toString())
    if (!response.ok) {
      return sendJsonNode(res, 502, { error: `Comfy image view request failed: ${response.status}` })
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const bytes = Buffer.from(await response.arrayBuffer())
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
    res.end(bytes)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'GENERATED_IMAGE_VIEW_ERROR' })
  } finally {
    runtime?.close?.()
  }
}

