import { getExtrapolationProgressRun } from '../../lib/extrapolation/progress-bus.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'

const HEARTBEAT_MS = 15_000

/**
 * @param {import('http').ServerResponse} res
 * @param {string} eventName
 * @param {Record<string, unknown>} payload
 */
function sseWrite(res, eventName, payload) {
  const data = JSON.stringify(payload ?? {})
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${data}\n\n`)
}

export default {
  routeKey: 'GET /api/extrapolation/:runId/stream',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/extrapolation\/[^/]+\/stream\/?$/.test(pathname)
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
    const m = pathname.match(/^\/api\/extrapolation\/([^/]+)\/stream\/?$/)
    const runId = m ? decodeURIComponent(m[1]) : ''
    if (!runId) {
      sendJsonMiddleware(res, 400, { error: 'Missing run id' })
      return
    }

    const bus = getExtrapolationProgressRun(runId)
    if (!bus) {
      sendJsonMiddleware(res, 404, { error: 'Unknown extrapolation run' })
      return
    }

    try {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      })
      res.write(': stream connected\n\n')

      let finished = false
      /** @type {() => void} */
      let unsub = () => {}

      const heartbeat = setInterval(() => {
        try {
          res.write(': keepalive\n\n')
        } catch {
          finish()
        }
      }, HEARTBEAT_MS)

      const finish = () => {
        if (finished) return
        finished = true
        clearInterval(heartbeat)
        unsub()
        try {
          res.end()
        } catch {
          /* ignore */
        }
      }

      unsub = bus.subscribe((record) => {
        const { seq: _seq, type, ...rest } = record
        sseWrite(res, type, { type, ...rest })
        if (type === 'run:end') {
          finish()
        }
      })

      req.on('close', finish)
    } catch (err) {
      if (!res.headersSent) {
        const normalized = normalizeHandlerError(err)
        sendJsonMiddleware(res, normalized.status, { error: normalized.message })
      }
    }
  },
}
