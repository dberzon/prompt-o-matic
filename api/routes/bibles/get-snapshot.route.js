import { getBibleSnapshot } from '../../lib/db/repositories/bibleSnapshots.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

/**
 * @param {string} pathname
 */
function parseSnapshotId(pathname) {
  const m = /^\/api\/bibles\/snapshots\/([^/]+)$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : ''
}

export default {
  routeKey: 'GET /api/bibles/snapshots/:snapshotId',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/snapshots\/[^/]+$/.test(pathname)
  },
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    let runtime = null
    try {
      const pathname = new URL(req.url || '', 'http://localhost').pathname
      const snapshotId = parseSnapshotId(pathname)
      if (!snapshotId) {
        sendJsonMiddleware(res, 400, { error: 'Missing snapshot id' })
        return
      }

      runtime = createVectorRuntime({ env: process.env })
      const { db } = runtime

      const snapshot = getBibleSnapshot(db, snapshotId)
      if (!snapshot) {
        sendJsonMiddleware(res, 404, { error: 'Snapshot not found' })
        return
      }

      sendJsonMiddleware(res, 200, { snapshot })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
