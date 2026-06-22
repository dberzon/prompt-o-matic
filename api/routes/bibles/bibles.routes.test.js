import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, listAttributes, writeAttribute } from '../../lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { projectBibleView } from '../../lib/bibles/projection.js'
import { discoverRoutes } from '../../vite-plugin/route-discovery.js'
import approveSectionRoute from './approve-section.route.js'
import completenessRoute from './completeness.route.js'
import extrapolateRoute from './extrapolate.route.js'
import getBibleRoute from './get.route.js'

const tempDirs = []
const openDbs = []

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bibles-routes-'))
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

describe('bibles HTTP routes (ya8d)', () => {
  it('registers four /api/bibles/* entries via route discovery', async () => {
    const cwd = process.cwd()
    const routes = await discoverRoutes({ cwd, routesDir: 'api/routes' })
    const keys = routes.map((r) => r.routeKey)
    expect(keys).toContain('GET /api/bibles/:entityId')
    expect(keys).toContain('GET /api/bibles/:entityId/completeness')
    expect(keys).toContain('POST /api/bibles/:entityId/approve-section')
    expect(keys).toContain('GET /api/bibles/:entityId/extrapolate')
  })

  describe('GET /api/bibles/:entityId', () => {
    it('returns bible and provenance', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_g', type: 'character', name: 'G' })
      seedFixtureAttributes(db, 'ent_g', minimalCharacterFixture)
      const view = projectBibleView(db, 'ent_g')

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/ent_g',
      })

      await withSqlitePath(dbPath, () => getBibleRoute.handler(req, res))

      expect(out.status).toBe(200)
      expect(out.body?.bible).toEqual(view.bible)
      expect(out.body?.bible).not.toHaveProperty('_provenance')
      expect(out.body?.provenance).toEqual(view.provenance)
      expect(out.body?.entityType).toBe('character')
    })

    it('returns partial bible after bank lift (description only, no Zod error)', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_lift', type: 'character', name: 'Lifted' })
      writeAttribute(db, {
        entityId: 'ent_lift',
        key: 'description',
        value: 'Weary detective in a wool coat.',
        provenance: 'canon',
        confidence: 1,
        sourceStage: 'lift',
      })

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/ent_lift',
      })

      await withSqlitePath(dbPath, () => getBibleRoute.handler(req, res))

      expect(out.status).toBe(200)
      expect(out.body?.entityType).toBe('character')
      expect(out.body?.bible).toEqual({})
      expect(out.body?.provenance).toEqual({})
    })

    it('returns a sparse bible instead of 500 for incomplete entities', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_sparse', type: 'character', name: 'Sparse' })

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/ent_sparse',
      })

      await withSqlitePath(dbPath, () => getBibleRoute.handler(req, res))

      expect(out.status).toBe(200)
      expect(out.body?.bible).toMatchObject({
        demographics: {},
        physical: {},
        visuals: {},
      })
      expect(out.body?.provenance).toEqual({})
    })

    it('returns 404 for unknown entity', async () => {
      const dbPath = tempDbPath()
      openDb(dbPath)
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/missing',
      })
      await withSqlitePath(dbPath, () => getBibleRoute.handler(req, res))
      expect(out.status).toBe(404)
      expect(out.body?.error).toMatch(/not found/i)
    })
  })

  describe('GET /api/bibles/:entityId/completeness', () => {
    it('returns completeness report', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_c', type: 'character', name: 'C' })
      seedFixtureAttributes(db, 'ent_c', minimalCharacterFixture)

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/ent_c/completeness',
      })
      await withSqlitePath(dbPath, () => completenessRoute.handler(req, res))
      expect(out.status).toBe(200)
      expect(typeof out.body?.ratio).toBe('number')
      expect(Array.isArray(out.body?.missingRequired)).toBe(true)
    })

    it('returns 404 for unknown entity', async () => {
      const dbPath = tempDbPath()
      openDb(dbPath)
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/ghost/completeness',
      })
      await withSqlitePath(dbPath, () => completenessRoute.handler(req, res))
      expect(out.status).toBe(404)
    })
  })

  describe('POST /api/bibles/:entityId/approve-section', () => {
    it('approves a section and returns { ok: true }', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_a', type: 'character', name: 'A' })
      seedFixtureAttributes(db, 'ent_a', minimalCharacterFixture)

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/bibles/ent_a/approve-section',
        body: { section: 'demographics', note: ' lgtm ' },
      })
      await withSqlitePath(dbPath, () => approveSectionRoute.handler(req, res))
      expect(out.status).toBe(200)
      expect(out.body?.ok).toBe(true)
      const rows = listAttributes(db, { entityId: 'ent_a', key: '_approval.demographics' })
      expect(rows).toHaveLength(1)
      expect(rows[0].value).toMatchObject({ state: 'approved', actor: 'api', note: 'lgtm' })
    })

    it('returns 404 for unknown entity', async () => {
      const dbPath = tempDbPath()
      openDb(dbPath)
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/bibles/nope/approve-section',
        body: { section: 'demographics' },
      })
      await withSqlitePath(dbPath, () => approveSectionRoute.handler(req, res))
      expect(out.status).toBe(404)
    })

    it('returns 400 for unknown section name for entity type', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_loc', type: 'location', name: 'Loc' })

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/bibles/ent_loc/approve-section',
        body: { section: 'demographics' },
      })
      await withSqlitePath(dbPath, () => approveSectionRoute.handler(req, res))
      expect(out.status).toBe(400)
      expect(String(out.body?.error)).toMatch(/unknown Bible section/i)
    })

    it('returns 400 for invalid JSON body (Zod strict)', async () => {
      const dbPath = tempDbPath()
      const db = openDb(dbPath)
      createEntity(db, { id: 'ent_z', type: 'character', name: 'Z' })

      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'POST',
        url: '/api/bibles/ent_z/approve-section',
        body: { section: 'visuals', extra: true },
      })
      await withSqlitePath(dbPath, () => approveSectionRoute.handler(req, res))
      expect(out.status).toBe(400)
      expect(out.body?.issues).toBeTruthy()
    })
  })

  describe('GET /api/bibles/:entityId/extrapolate', () => {
    it('returns 501 stub', async () => {
      const { res, out } = mockRes()
      const req = /** @type {import('http').IncomingMessage} */ ({
        method: 'GET',
        url: '/api/bibles/any/extrapolate',
      })
      await extrapolateRoute.handler(req, res)
      expect(out.status).toBe(501)
      expect(out.body?.error).toMatch(/not implemented/i)
    })
  })
})
