import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEntity } from '../../lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { clearExtrapolationRunTrackingForTests } from '../../lib/extrapolation/extrapolationRunStore.js'
import { clearExtrapolationProgressRunsForTests } from '../../lib/extrapolation/progress-bus.js'
import statusRoute from '../extrapolation/status.route.js'
import streamRoute from '../extrapolation/stream.route.js'

const { rawFn } = vi.hoisted(() => ({
  rawFn: vi.fn(),
}))

vi.mock('../../lib/llm/client.js', () => ({
  createLlmClient: () => ({ raw: rawFn }),
}))

import autofillRoute from './autofill.route.js'

const s1Ok = JSON.stringify({
  primary: { attributes: [{ key: 'description', value: 'Route test canon description.' }] },
  entities: [],
})

const tempDirs = []

afterEach(() => {
  clearExtrapolationProgressRunsForTests()
  clearExtrapolationRunTrackingForTests()
  while (tempDirs.length) {
    try {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
    } catch {
      /* Windows may hold SQLite briefly */
    }
  }
  vi.clearAllMocks()
})

function mockJsonRes() {
  /** @type {{ status?: number, body?: unknown }} */
  const out = {}
  const res = /** @type {import('http').ServerResponse} */ ({
    writeHead(status, headers) {
      out.status = status
      if (headers && typeof headers === 'object') Object.assign(out, { hdr: headers })
    },
    end(chunk) {
      try {
        out.body = chunk ? JSON.parse(String(chunk)) : {}
      } catch {
        out.body = chunk
      }
    },
  })
  return { res, out }
}

function createMockSseReqRes(url) {
  /** @type {(() => void)[]} */
  const closeListeners = []
  const req = /** @type {import('http').IncomingMessage} */ ({
    method: 'GET',
    url,
    on(ev, fn) {
      if (ev === 'close') closeListeners.push(fn)
    },
  })
  let written = ''
  let ended = false
  const res = /** @type {import('http').ServerResponse} */ ({
    headersSent: false,
    statusCode: 0,
    headers: /** @type {Record<string, string>} */ ({}),
    writeHead(code, headers) {
      this.statusCode = code
      if (headers) Object.assign(this.headers, headers)
      this.headersSent = true
    },
    write(chunk) {
      written += String(chunk)
    },
    end(chunk) {
      if (ended) return
      ended = true
      if (chunk !== undefined && chunk !== null) written += String(chunk)
    },
  })
  return {
    req,
    res,
    getWritten: () => written,
    getEnded: () => ended,
    fireClose: () => closeListeners.forEach((fn) => fn()),
  }
}

describe('POST /api/agents/autofill-bible', () => {
  it('returns 202 with runId and SSE emits iter and run lifecycle', async () => {
    rawFn.mockResolvedValue(s1Ok)

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-autofill-route-'))
    tempDirs.push(dir)
    const dbPath = path.join(dir, 'db.sqlite')
    const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio', SQLITE_DB_PATH: dbPath } })
    initializeDatabase(db)
    createEntity(db, { id: 'ent_route_sse', type: 'character', name: 'SSE Hero' })
    db.close()

    const prev = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath

    try {
      const { res: postRes, out: postOut } = mockJsonRes()
      const postReq = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/agents/autofill-bible',
        body: { entityId: 'ent_route_sse', maxIterations: 4 },
      })
      await autofillRoute.handler(postReq, postRes)
      expect(postOut.status).toBe(202)
      expect(postOut.body?.runId).toMatch(/^[0-9a-f-]{36}$/i)
      const runId = postOut.body.runId

      const { req: sreq, res: sres, getWritten, fireClose } = createMockSseReqRes(
        `/api/extrapolation/${encodeURIComponent(runId)}/stream`,
      )
      const streamPromise = streamRoute.handler(sreq, sres)
      expect(sres.headers['Content-Type']).toBe('text/event-stream')

      await new Promise((r) => setTimeout(r, 400))

      const w = getWritten()
      expect(w).toContain('event: run:start')
      expect(w).toContain('event: iter:start')
      expect(w).toContain('event: iter:end')
      expect(w.match(/event: run:end/g)?.length).toBe(1)

      const { res: statusRes, out: statusOut } = mockJsonRes()
      const statusReq = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: `/api/extrapolation/${encodeURIComponent(runId)}/status`,
      })
      await statusRoute.handler(statusReq, statusRes)
      expect(statusOut.status).toBe(200)
      expect(statusOut.body).toMatchObject({
        runId,
        done: true,
        cancelled: false,
        error: null,
        result: { ok: true, entityId: 'ent_route_sse' },
      })

      fireClose()
      await streamPromise
    } finally {
      if (prev === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = prev
    }
  })
})
