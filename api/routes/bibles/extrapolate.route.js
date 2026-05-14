import { sendJsonMiddleware } from '../../lib/http.js'

export default {
  routeKey: 'GET /api/bibles/:entityId/extrapolate',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/[^/]+\/extrapolate$/.test(pathname)
  },
  /**
   * Stub until Phase 5 SSE progress bus (see arch.phase5.sse-progress-bus).
   *
   * @param {import('http').IncomingMessage} _req
   * @param {import('http').ServerResponse} res
   */
  async handler(_req, res) {
    sendJsonMiddleware(res, 501, {
      error: 'Not implemented',
      detail: 'Bible extrapolate streaming is not wired yet.',
    })
  },
}
