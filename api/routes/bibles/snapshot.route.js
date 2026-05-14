import { z } from 'zod'
import { EntityNotFoundError, projectBible } from '../../lib/bibles/projection.js'
import { createBibleSnapshot, getBibleSnapshot } from '../../lib/db/repositories/bibleSnapshots.js'
import { getEntity } from '../../lib/db/repositories.js'
import { normalizeHandlerError, readJsonBody, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

const bodySchema = z
  .object({
    label: z.string().trim().min(1),
    parentSnapshotId: z.string().uuid().optional(),
  })
  .strict()

/**
 * @param {string} pathname
 */
function parseEntityIdFromPath(pathname) {
  const m = /^\/api\/bibles\/([^/]+)\/snapshot$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : ''
}

export default {
  routeKey: 'POST /api/bibles/:entityId/snapshot',
  method: 'POST',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/[^/]+\/snapshot$/.test(pathname)
  },
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
      const pathname = new URL(req.url || '', 'http://localhost').pathname
      const entityId = parseEntityIdFromPath(pathname)
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

      let bibleJson
      try {
        bibleJson = projectBible(db, entityId)
      } catch (err) {
        if (err instanceof EntityNotFoundError) {
          sendJsonMiddleware(res, 404, { error: 'Entity not found' })
          return
        }
        throw err
      }

      const entity = getEntity(db, entityId)
      const projectId = entity?.projectId ?? null

      const { label, parentSnapshotId } = parsed.data
      if (parentSnapshotId) {
        const parent = getBibleSnapshot(db, parentSnapshotId)
        if (!parent || parent.entityId !== entityId) {
          sendJsonMiddleware(res, 400, { error: 'Invalid parentSnapshotId' })
          return
        }
      }

      const snapshot = createBibleSnapshot(db, {
        entityId,
        projectId,
        label,
        bibleJson,
        parentSnapshotId: parentSnapshotId ?? null,
      })

      sendJsonMiddleware(res, 200, { ok: true, snapshot })
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
