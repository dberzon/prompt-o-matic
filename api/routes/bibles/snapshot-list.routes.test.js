import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, writeAttribute } from '../../lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { projectCharacterBible } from '../../lib/bibles/projection.js'
import { createBibleSnapshot } from '../../lib/db/repositories/bibleSnapshots.js'
import { discoverRoutes } from '../../vite-plugin/route-discovery.js'
import getSnapshotRoute from './get-snapshot.route.js'
import listSnapshotsRoute from './list-snapshots.route.js'

const tempDirs = []
const openDbs = []

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bibles-snapshot-list-'))
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

function withSqlitePath(dbPath, fn) {
  const orig = process.env.SQLITE_DB_PATH
  process.env.SQLITE_DB_PATH = dbPath
  try {
    return fn()
  } finally {
    if (orig === undefined) delete process.env.SQLITE_DB_PATH
    else process.env.SQLITE_DB_PATH = orig
  }
}

const minimalCharacterFixture = {
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

describe('bible snapshot GET routes (t44d)', () => {
  it('registers list and get routes via route discovery', async () => {
    const cwd = process.cwd()
    const routes = await discoverRoutes({ cwd, routesDir: 'api/routes' })
    const keys = routes.map((r) => r.routeKey)
    expect(keys).toContain('GET /api/bibles/:entityId/snapshots')
    expect(keys).toContain('GET /api/bibles/snapshots/:snapshotId')
  })

  describe('GET /api/bibles/:entityId/snapshots', () => {
    it('returns snapshots newest first for entity', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_list', type: 'character', name: 'List' })
      seedFixtureAttributes(db, 'ent_list', minimalCharacterFixture)
      const bibleJson = projectCharacterBible(db, 'ent_list')

      const older = createBibleSnapshot(db, {
        entityId: 'ent_list',
        label: 'older',
        bibleJson,
      })
      const newer = createBibleSnapshot(db, {
        entityId: 'ent_list',
        label: 'newer',
        bibleJson,
      })
      db.prepare('UPDATE bible_snapshots SET created_at = ? WHERE id = ?').run(
        '2026-01-01T00:00:00.000Z',
        older.id,
      )
      db.prepare('UPDATE bible_snapshots SET created_at = ? WHERE id = ?').run(
        '2026-01-02T00:00:00.000Z',
        newer.id,
      )

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/ent_list/snapshots',
      })

      await withSqlitePath(dbPath, () => listSnapshotsRoute.handler(req, res))

      expect(out.status).toBe(200)
      const snaps = out.body?.snapshots
      expect(Array.isArray(snaps)).toBe(true)
      expect(snaps).toHaveLength(2)
      expect(snaps[0].id).toBe(newer.id)
      expect(snaps[1].id).toBe(older.id)
      expect(snaps[0].label).toBe('newer')
    })

    it('returns 404 for unknown entity', async () => {
      const dbPath = tempDbPath()
      openDb(dbPath)
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/missing/snapshots',
      })
      await withSqlitePath(dbPath, () => listSnapshotsRoute.handler(req, res))
      expect(out.status).toBe(404)
    })
  })

  describe('GET /api/bibles/snapshots/:snapshotId', () => {
    it('returns one snapshot by id', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_get', type: 'character', name: 'Get' })
      seedFixtureAttributes(db, 'ent_get', minimalCharacterFixture)
      const bibleJson = projectCharacterBible(db, 'ent_get')
      const created = createBibleSnapshot(db, {
        entityId: 'ent_get',
        label: 'target',
        bibleJson,
      })

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: `/api/bibles/snapshots/${created.id}`,
      })

      await withSqlitePath(dbPath, () => getSnapshotRoute.handler(req, res))

      expect(out.status).toBe(200)
      expect(out.body?.snapshot?.id).toBe(created.id)
      expect(out.body?.snapshot?.label).toBe('target')
      expect(out.body?.snapshot?.bibleJson).toEqual(bibleJson)
    })

    it('returns 404 for unknown snapshot id', async () => {
      const dbPath = tempDbPath()
      openDb(dbPath)
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/snapshots/00000000-0000-4000-8000-000000000000',
      })
      await withSqlitePath(dbPath, () => getSnapshotRoute.handler(req, res))
      expect(out.status).toBe(404)
      expect(out.body?.error).toMatch(/not found/i)
    })
  })
})
