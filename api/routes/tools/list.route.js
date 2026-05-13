import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { getCachedToolRegistry, toolDescriptorsForApi } from '../../lib/tools/httpInvoke.js'

export default {
  routeKey: 'GET /api/tools',
  method: 'GET',
  path: '/api/tools',
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    try {
      if (req.method !== 'GET') {
        sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        return
      }
      const registry = await getCachedToolRegistry()
      const tools = toolDescriptorsForApi(registry)
      sendJsonMiddleware(res, 200, { ok: true, tools })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    }
  },
}
