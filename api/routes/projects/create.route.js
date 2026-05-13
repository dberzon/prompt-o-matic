import { z } from 'zod'
import { createProject, UniqueConstraintError } from '../../lib/db/repositories/projects.js'
import { normalizeHandlerError, readJsonBody, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

const bodySchema = z
  .object({
    slug: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .strict()

export default {
  routeKey: 'POST /api/projects',
  method: 'POST',
  path: '/api/projects',
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    let runtime = null
    try {
      if (req.method !== 'POST') {
        sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        return
      }
      runtime = createVectorRuntime({ env: process.env })
      const raw = req.body !== undefined ? req.body : await readJsonBody(req)
      const parsed = bodySchema.safeParse(raw)
      if (!parsed.success) {
        sendJsonMiddleware(res, 400, {
          error: 'Invalid request body',
          issues: parsed.error.issues,
        })
        return
      }
      try {
        const item = createProject(runtime.db, parsed.data)
        sendJsonMiddleware(res, 200, { ok: true, item })
      } catch (err) {
        if (err instanceof UniqueConstraintError) {
          sendJsonMiddleware(res, 409, { error: err.message, code: err.code })
          return
        }
        throw err
      }
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
