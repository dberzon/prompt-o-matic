import { listProjects } from '../../lib/db/repositories/projects.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

export default {
  routeKey: 'GET /api/projects',
  method: 'GET',
  path: '/api/projects',
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    let runtime = null
    try {
      if (req.method !== 'GET') {
        sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        return
      }
      runtime = createVectorRuntime({ env: process.env })
      const items = listProjects(runtime.db)
      sendJsonMiddleware(res, 200, { ok: true, items })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
