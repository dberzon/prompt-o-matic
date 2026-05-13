import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity } from '../../lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { clearCachedToolRegistry } from '../../lib/tools/httpInvoke.js'
import invokeRoute from './invoke.route.js'
import listRoute from './list.route.js'

const tempDirs = []

afterEach(() => {
  clearCachedToolRegistry()
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function mockRes() {
  /** @type {{ status?: number, body?: unknown, headers: Record<string,string> }} */
  const out = { headers: {} }
  const res = {
    writeHead(status, headers) {
      out.status = status
      if (headers) Object.assign(out.headers, headers)
    },
    end(chunk) {
      try {
        out.body = chunk ? JSON.parse(String(chunk)) : {}
      } catch {
        out.body = chunk
      }
    },
  }
  return { res, out }
}

describe('tools routes', () => {
  it('GET /api/tools lists tools with JSON schemas', async () => {
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/tools',
    })
    await listRoute.handler(req, res)
    expect(out.status).toBe(200)
    expect(out.body?.ok).toBe(true)
    expect(Array.isArray(out.body?.tools)).toBe(true)
    const names = out.body.tools.map((t) => t.name).sort()
    expect(names).toContain('detect-gaps')
    expect(names).toContain('run-stage')
  })

  it('POST invoke returns gaps for detect-gaps', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-tools-route-'))
    tempDirs.push(dir)
    const dbPath = path.join(dir, 'db.sqlite')
    const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio', SQLITE_DB_PATH: dbPath } })
    initializeDatabase(db)
    createEntity(db, { id: 'e_tools', type: 'character', name: 'Y' })
    db.close()

    const prev = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/tools/detect-gaps',
        body: { input: { entityId: 'e_tools' } },
      })
      await invokeRoute.handler(req, res)
      expect(out.status).toBe(200)
      expect(out.body?.ok).toBe(true)
      expect(out.body?.output?.gaps?.length).toBeGreaterThan(0)
    } finally {
      if (prev === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = prev
    }
  })

  it('POST invoke unknown tool returns 404', async () => {
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/tools/no-such-tool-ever',
      body: { input: {} },
    })
    await invokeRoute.handler(req, res)
    expect(out.status).toBe(404)
    expect(out.body?.error?.code).toBe('tool_not_found')
  })
})
