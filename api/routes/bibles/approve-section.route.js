import { z } from 'zod'
import { approveBibleSection } from '../../lib/bibles/approval.js'
import { EntityNotFoundError } from '../../lib/bibles/projection.js'
import { normalizeHandlerError, readJsonBody, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

const bodySchema = z
  .object({
    section: z.string().min(1),
    note: z.string().optional(),
  })
  .strict()

const DEFAULT_APPROVAL_ACTOR = 'api'

/**
 * @param {string} pathname
 */
function parseEntityId(pathname) {
  const m = /^\/api\/bibles\/([^/]+)\/approve-section$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : ''
}

export default {
  routeKey: 'POST /api/bibles/:entityId/approve-section',
  method: 'POST',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/[^/]+\/approve-section$/.test(pathname)
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

      const raw = req.body !== undefined ? req.body : await readJsonBody(req)
      const parsed = bodySchema.safeParse(raw)
      if (!parsed.success) {
        sendJsonMiddleware(res, 400, {
          error: 'Invalid request body',
          issues: parsed.error.issues,
        })
        return
      }

      runtime = createVectorRuntime({ env: process.env })
      const { db } = runtime

      const section = parsed.data.section.trim()
      const note = parsed.data.note

      try {
        approveBibleSection(db, entityId, section, {
          actor: DEFAULT_APPROVAL_ACTOR,
          ...(note !== undefined ? { note } : {}),
        })
      } catch (err) {
        if (err instanceof EntityNotFoundError) {
          sendJsonMiddleware(res, 404, { error: 'Entity not found' })
          return
        }
        if (err instanceof Error && /unknown Bible section/i.test(err.message)) {
          sendJsonMiddleware(res, 400, { error: err.message })
          return
        }
        throw err
      }

      sendJsonMiddleware(res, 200, { ok: true })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
