import { z } from 'zod'
import { cancelAutofillRun } from '../../lib/agents/autofillRunRegistry.js'
import { readJsonBody, sendJsonMiddleware } from '../../lib/http.js'

const bodySchema = z
  .object({
    runId: z.string().min(1),
  })
  .strict()

export default {
  routeKey: 'POST /api/agents/autofill-bible/cancel',
  method: 'POST',
  path: '/api/agents/autofill-bible/cancel',
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    if (req.method !== 'POST') {
      sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
      return
    }

    const raw = req.body !== undefined ? req.body : await readJsonBody(req)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      sendJsonMiddleware(res, 400, { error: 'Invalid request body', issues: parsed.error.issues })
      return
    }

    const cancelled = cancelAutofillRun(parsed.data.runId)
    if (!cancelled.ok) {
      sendJsonMiddleware(res, 404, { error: 'Unknown autofill run' })
      return
    }

    sendJsonMiddleware(res, 200, {
      ok: true,
      runId: parsed.data.runId,
      entityId: cancelled.entityId,
      cancelled: true,
    })
  },
}
