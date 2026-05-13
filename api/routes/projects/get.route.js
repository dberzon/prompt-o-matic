import { getProjectById } from '../../lib/db/repositories/projects.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

export default {
  routeKey: 'GET /api/projects/:id',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/projects\/[^/]+$/.test(pathname) && pathname !== '/api/projects'
  },
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
      const pathname = new URL(req.url || '', 'http://localhost').pathname
      const id = decodeURIComponent(pathname.replace(/^\/api\/projects\//, ''))
      if (!id) {
        sendJsonMiddleware(res, 400, { error: 'Missing project id' })
        return
      }
      runtime = createVectorRuntime({ env: process.env })
      const item = getProjectById(runtime.db, id)
      if (!item) {
        sendJsonMiddleware(res, 404, { error: 'Project not found' })
        return
      }
      sendJsonMiddleware(res, 200, { ok: true, item })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
