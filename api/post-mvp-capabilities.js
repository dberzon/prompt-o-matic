import { buildDeferredCapabilitiesReport } from './lib/postMvp/deferredCapabilities.js'
import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  let runtime = null
  try {
    runtime = createVectorRuntime({ env: process.env })
    const report = buildDeferredCapabilitiesReport(runtime.db, process.env)
    return sendJsonNode(res, 200, { ok: true, ...report })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'POST_MVP_CAPABILITIES_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
