import {
  invokeRegisteredTool,
  ToolInputValidationError,
  ToolNotFoundError,
  ToolOutputValidationError,
} from '../../lib/tools/httpInvoke.js'
import { normalizeHandlerError, readJsonBody, sendJsonMiddleware } from '../../lib/http.js'

export default {
  routeKey: 'POST /api/tools/:name',
  method: 'POST',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/tools\/[^/]+$/.test(pathname)
  },
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    try {
      if (req.method !== 'POST') {
        sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        return
      }
      const pathname = new URL(req.url || '', 'http://localhost').pathname
      const name = decodeURIComponent(pathname.replace(/^\/api\/tools\//, ''))
      if (!name) {
        sendJsonMiddleware(res, 400, { error: 'Missing tool name' })
        return
      }
      const body = req.body !== undefined ? req.body : await readJsonBody(req)
      const input = body && typeof body === 'object' && 'input' in body ? body.input : body
      const output = await invokeRegisteredTool(process.env, name, input)
      sendJsonMiddleware(res, 200, { ok: true, output })
    } catch (err) {
      if (err instanceof ToolNotFoundError) {
        sendJsonMiddleware(res, 404, {
          error: { code: 'tool_not_found', message: err.message },
        })
        return
      }
      if (err instanceof ToolInputValidationError) {
        sendJsonMiddleware(res, 400, {
          error: {
            code: 'tool_input_invalid',
            message: err.message,
            issues: err.issues,
          },
        })
        return
      }
      if (err instanceof ToolOutputValidationError) {
        sendJsonMiddleware(res, 500, {
          error: {
            code: 'tool_output_invalid',
            message: err.message,
            issues: err.issues,
          },
        })
        return
      }
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    }
  },
}
