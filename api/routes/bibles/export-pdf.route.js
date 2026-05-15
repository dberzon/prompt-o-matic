import { z } from 'zod'
import { EntityNotFoundError, projectBibleDraft } from '../../lib/bibles/projection.js'
import { renderBibleMarkdown, renderBiblePdf } from '../../lib/bibles/render.js'
import { getBibleSnapshot } from '../../lib/db/repositories/bibleSnapshots.js'
import { normalizeHandlerError, sendJsonMiddleware } from '../../lib/http.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'

const snapshotIdSchema = z.string().uuid()

/**
 * @param {string} pathname
 */
function parseEntityIdFromPath(pathname) {
  const m = /^\/api\/bibles\/([^/]+)\/export\.pdf$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : ''
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {string} [snapshotId]
 */
function resolveBibleOrError(db, entityId, snapshotId) {
  const trimmed = (snapshotId ?? '').trim()
  if (trimmed) {
    const idParse = snapshotIdSchema.safeParse(trimmed)
    if (!idParse.success) {
      return { error: { status: 404, message: 'Snapshot not found' } }
    }
    const snap = getBibleSnapshot(db, trimmed)
    if (!snap || snap.entityId !== entityId) {
      return { error: { status: 404, message: 'Snapshot not found' } }
    }
    if (!snap.bibleJson || typeof snap.bibleJson !== 'object') {
      return { error: { status: 404, message: 'Snapshot not found' } }
    }
    return { bible: snap.bibleJson }
  }
  try {
    return { bible: projectBibleDraft(db, entityId) }
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      return { error: { status: 404, message: 'Entity not found' } }
    }
    throw err
  }
}

export default {
  routeKey: 'GET /api/bibles/:entityId/export.pdf',
  method: 'GET',
  /**
   * @param {string} pathname
   */
  match(pathname) {
    return /^\/api\/bibles\/[^/]+\/export\.pdf$/.test(pathname)
  },
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    let runtime = null
    try {
      if (req.method !== 'GET') {
        sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
        return
      }
      const pathname = new URL(req.url || '', 'http://localhost').pathname
      const entityId = parseEntityIdFromPath(pathname)
      if (!entityId) {
        sendJsonMiddleware(res, 400, { error: 'Missing entity id' })
        return
      }
      const snapshotId = new URL(req.url || '', 'http://localhost').searchParams.get('snapshotId') ?? undefined

      runtime = createVectorRuntime({ env: process.env })
      const { db } = runtime

      const resolved = resolveBibleOrError(db, entityId, snapshotId)
      if (resolved.error) {
        sendJsonMiddleware(res, resolved.error.status, { error: resolved.error.message })
        return
      }

      const md = renderBibleMarkdown(resolved.bible)
      const buf = await renderBiblePdf(md)
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        sendJsonMiddleware(res, 500, { error: 'PDF generation failed' })
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      })
      res.end(buf)
    } catch (err) {
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    } finally {
      runtime?.close?.()
    }
  },
}
