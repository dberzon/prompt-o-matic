import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { createProject, getProjectById } from '../../lib/db/repositories/projects.js'
import createRoute from './create.route.js'
import getRoute from './get.route.js'
import listRoute from './list.route.js'

const tempDirs = []
const openDbs = []

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-projects-routes-'))
  tempDirs.push(dir)
  return path.join(dir, 't.sqlite')
}

function openDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

afterEach(() => {
  while (openDbs.length) {
    try {
      openDbs.pop().close()
    } catch {}
  }
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

describe('projects route handlers', () => {
  it('GET list returns projects array', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createProject(db, { slug: 'alpha', name: 'Alpha' })

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/projects',
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await listRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.body?.ok).toBe(true)
    expect(Array.isArray(out.body?.items)).toBe(true)
    expect(out.body.items.length).toBeGreaterThanOrEqual(1)
  })

  it('POST create validates body (400)', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/projects',
      body: { slug: '', name: 'X' },
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await createRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(400)
    expect(out.body?.issues).toBeTruthy()
  })

  it('GET by id returns 404 for unknown id', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/projects/00000000-0000-4000-8000-000000000099',
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await getRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(404)
  })

  it('POST create then GET by id round-trip', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      const { res: cres, out: cout } = mockRes()
      const creq = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/projects',
        body: { slug: 'rt', name: 'Round Trip' },
      })
      await createRoute.handler(creq, cres)
      expect(cout.status).toBe(200)
      const id = cout.body?.item?.id
      expect(id).toBeTruthy()

      const { res: gres, out: gout } = mockRes()
      const greq = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: `/api/projects/${encodeURIComponent(id)}`,
      })
      await getRoute.handler(greq, gres)
      expect(gout.status).toBe(200)
      expect(gout.body?.item?.slug).toBe('rt')
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
  })
})
