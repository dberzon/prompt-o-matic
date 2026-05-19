import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, writeAttribute } from '../../lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { projectCharacterBible } from '../../lib/bibles/projection.js'
import { createBibleSnapshot } from '../../lib/db/repositories/bibleSnapshots.js'
import { discoverRoutes } from '../../vite-plugin/route-discovery.js'
import snapshotRoute from './snapshot.route.js'

const tempDirs = []
const openDbs = []

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bibles-snapshot-route-'))
  tempDirs.push(dir)
  return path.join(dir, 't.sqlite')
}

function openDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {Record<string, unknown>} fixture
 */
function seedFixtureAttributes(db, entityId, fixture) {
  /**
   * @param {string} prefix
   * @param {unknown} value
   */
  function walk(prefix, value) {
    if (Array.isArray(value)) {
      writeAttribute(db, { entityId, key: prefix, value, provenance: 'canon' })
      return
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        const next = prefix ? `${prefix}.${k}` : k
        walk(next, v)
      }
      return
    }
    writeAttribute(db, { entityId, key: prefix, value, provenance: 'canon' })
  }
  for (const [k, v] of Object.entries(fixture)) {
    walk(k, v)
  }
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

describe('POST /api/bibles/:entityId/snapshot', () => {
  it('is registered by route discovery', async () => {
    const cwd = process.cwd()
    const routes = await discoverRoutes({ cwd, routesDir: 'api/routes' })
    const keys = routes.map((r) => r.routeKey)
    expect(keys).toContain('POST /api/bibles/:entityId/snapshot')
  })

  it('happy path: freezes projected Bible and returns snapshot', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const db = openDbs[openDbs.length - 1]
    createEntity(db, { id: 'ent_snap', type: 'character', name: 'Snap' })
    const minimal = {
      demographics: { gender: 'nb', ageRange: '40s', eraLabel: 'Present', housingNotes: 'Unknown.' },
      physical: {
        height: 'medium',
        build: 'stocky',
        face: 'square',
        eyes: 'hazel',
        nose: 'wide',
        lips: 'thin',
        skin: 'fair',
      },
      visuals: { portraitBrief: 'bust', continuityKeywords: [] },
    }
    seedFixtureAttributes(db, 'ent_snap', minimal)
    const expected = projectCharacterBible(db, 'ent_snap')

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/bibles/ent_snap/snapshot',
      body: { label: 'v1 approved' },
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await snapshotRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.body?.ok).toBe(true)
    const snap = out.body?.snapshot
    expect(snap?.id).toBeTruthy()
    expect(snap?.entityId).toBe('ent_snap')
    expect(snap?.label).toBe('v1 approved')
    expect(snap?.bibleJson).toEqual(expected)
    expect(snap?.parentSnapshotId).toBeNull()
  })

  it('snapshots incomplete entities instead of returning 500', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createEntity(db, { id: 'ent_incomplete_snap', type: 'character', name: 'Incomplete' })

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/bibles/ent_incomplete_snap/snapshot',
      body: { label: 'draft' },
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await snapshotRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.body?.snapshot?.bibleJson).toMatchObject({
      demographics: {},
      physical: {},
      relationships: [],
      visuals: {},
      _provenance: {},
    })
  })

  it('returns 400 when label is missing', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/bibles/ent_x/snapshot',
      body: {},
    })
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await snapshotRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
    expect(out.status).toBe(400)
    expect(out.body?.issues).toBeTruthy()
  })

  it('returns 400 when label is only whitespace', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/bibles/ent_x/snapshot',
      body: { label: '   ' },
    })
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await snapshotRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
    expect(out.status).toBe(400)
  })

  it('returns 404 for unknown entity', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/bibles/no-such-entity/snapshot',
      body: { label: 'x' },
    })
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await snapshotRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
    expect(out.status).toBe(404)
    expect(out.body?.error).toMatch(/not found/i)
  })

  it('round-trips parentSnapshotId for same entity', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createEntity(db, { id: 'ent_parent', type: 'character', name: 'P' })
    const minimal = {
      demographics: { gender: 'f', ageRange: '20s', eraLabel: 'X', housingNotes: 'Y' },
      physical: {
        height: 'tall',
        build: 'slim',
        face: 'oval',
        eyes: 'blue',
        nose: 'small',
        lips: 'full',
        skin: 'light',
      },
      visuals: { portraitBrief: 'x', continuityKeywords: ['a'] },
    }
    seedFixtureAttributes(db, 'ent_parent', minimal)

    const first = createBibleSnapshot(db, {
      entityId: 'ent_parent',
      label: 'first',
      bibleJson: projectCharacterBible(db, 'ent_parent'),
    })

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'POST',
      url: '/api/bibles/ent_parent/snapshot',
      body: { label: 'second', parentSnapshotId: first.id },
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await snapshotRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.body?.snapshot?.parentSnapshotId).toBe(first.id)
  })
})
