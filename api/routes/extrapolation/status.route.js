import { getExtrapolationRunTracking } from '../../lib/extrapolation/extrapolationRunStore.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'

export default {
  routeKey: 'GET /api/extrapolation/:runId/status',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/extrapolation\/[^/]+\/status\/?$/.test(pathname)
  },
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    if (req.method !== 'GET') {
      sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
      return
    }
    const pathname = new URL(req.url || '', 'http://localhost').pathname
    const m = pathname.match(/^\/api\/extrapolation\/([^/]+)\/status\/?$/)
    const runId = m ? decodeURIComponent(m[1]) : ''
    if (!runId) {
      sendJsonMiddleware(res, 400, { error: 'Missing run id' })
      return
    }

    try {
      const tracking = getExtrapolationRunTracking(runId)
      if (!tracking) {
        sendJsonMiddleware(res, 404, { error: 'Unknown extrapolation run' })
        return
      }
      const snap = tracking.getSnapshot()
      sendJsonMiddleware(res, 200, {
        runId,
        done: snap.settled,
        cancelled: snap.cancelled,
        result: snap.result,
        error: snap.error,
        events: snap.events,
      })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    }
  },
}
