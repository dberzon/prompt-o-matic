import { runPolish } from './lib/polishCore.js'
import { normalizeHandlerError, sendJsonNode } from './lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  try {
    const result = await runPolish({ payload: req.body })
    return sendJsonNode(res, 200, result)
  } catch (err) {
    console.error('Polish handler error:', err?.message, err?.meta ?? '')
    const normalized = normalizeHandlerError(err)
    return sendJsonNode(res, normalized.status, { error: normalized.message })
  }
}
