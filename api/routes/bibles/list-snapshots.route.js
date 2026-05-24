import { getEntity } from '../../lib/db/repositories.js'
import { listBibleSnapshots } from '../../lib/db/repositories/bibleSnapshots.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

/**
 * @param {string} pathname
 */
function parseEntityId(pathname) {
  const m = /^\/api\/bibles\/([^/]+)\/snapshots$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : ''
}

export default {
  routeKey: 'GET /api/bibles/:entityId/snapshots',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/[^/]+\/snapshots$/.test(pathname)
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

      const entity = getEntity(db, entityId)
      if (!entity) {
        sendJsonMiddleware(res, 404, { error: 'Entity not found' })
        return
      }

      const snapshots = listBibleSnapshots(db, { entityId })
      sendJsonMiddleware(res, 200, { snapshots })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
