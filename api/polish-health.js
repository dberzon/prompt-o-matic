import { healthCheck } from './lib/polishCore.js'
import { normalizeHandlerError, sendJsonNode } from './lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  try {
    const engine = typeof req.query?.engine === 'string' ? req.query.engine : 'auto'
    const localOnly = req.query?.localOnly === '1' || req.query?.localOnly === 'true'
    const payload = {
      embeddedPort: req.query?.embeddedPort ? Number(req.query.embeddedPort) : null,
      embeddedSecret: typeof req.query?.embeddedSecret === 'string' ? req.query.embeddedSecret : null,
      embeddedModel: typeof req.query?.embeddedModel === 'string' ? req.query.embeddedModel : null,
      localProvider: typeof req.query?.localProvider === 'string' ? req.query.localProvider : null,
      lmStudioBaseUrl: typeof req.query?.lmStudioBaseUrl === 'string' ? req.query.lmStudioBaseUrl : null,
      lmStudioModel: typeof req.query?.lmStudioModel === 'string' ? req.query.lmStudioModel : null,
    }
    const status = await healthCheck({ engine, localOnly, payload })
    return sendJsonNode(res, 200, status)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message })
  }
}
