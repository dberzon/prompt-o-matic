import { EntityNotFoundError, projectBibleForApi } from '../../lib/bibles/projection.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

/**
 * @param {string} pathname
 */
function parseEntityId(pathname) {
  const m = /^\/api\/bibles\/([^/]+)$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : ''
}

export default {
  routeKey: 'GET /api/bibles/:entityId',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/[^/]+$/.test(pathname)
  },
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    let runtime = null
    try {
      const pathname = new URL(req.url || '', 'http://localhost').pathname
      const entityId = parseEntityId(pathname)
      if (!entityId) {
        sendJsonMiddleware(res, 400, { error: 'Missing entity id' })
        return
      }

      runtime = createVectorRuntime({ env: process.env })
      const { db } = runtime

      let projected
      try {
        projected = projectBibleForApi(db, entityId)
      } catch (err) {
        if (err instanceof EntityNotFoundError) {
          sendJsonMiddleware(res, 404, { error: 'Entity not found' })
          return
        }
        throw err
      }

      const { _provenance, ...bible } = projected
      sendJsonMiddleware(res, 200, { bible, provenance: _provenance })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
