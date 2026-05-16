import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, writeAttribute } from '../../lib/db/repositories.js'
import { createBibleSnapshot } from '../../lib/db/repositories/bibleSnapshots.js'
import { createSqliteDatabase, initializeDatabase } from '../../lib/db/sqlite.js'
import { projectCharacterBible } from '../../lib/bibles/projection.js'
import { discoverRoutes } from '../../vite-plugin/route-discovery.js'
import exportMdRoute from './export-md.route.js'
import exportPdfRoute from './export-pdf.route.js'

const tempDirs = []
const openDbs = []

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bibles-export-route-'))
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
      out.body = chunk
    },
  }
  return { res, out }
}

describe('Bible export routes', () => {
  it('are registered by route discovery', async () => {
    const cwd = process.cwd()
    const routes = await discoverRoutes({ cwd, routesDir: 'api/routes' })
    const keys = routes.map((r) => r.routeKey)
    expect(keys).toContain('GET /api/bibles/:entityId/export.md')
    expect(keys).toContain('GET /api/bibles/:entityId/export.pdf')
  })

  it('GET export.md returns markdown for live projection', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createEntity(db, { id: 'ent_ex', type: 'character', name: 'Ex' })
    const minimal = {
      demographics: { gender: 'm', ageRange: '20s', eraLabel: 'X', housingNotes: 'Y' },
      physical: {
        height: 'tall',
        build: 'slim',
        face: 'oval',
        eyes: 'blue',
        nose: 'small',
        lips: 'full',
        skin: 'light',
      },
      visuals: { portraitBrief: 'x', continuityKeywords: [] },
    }
    seedFixtureAttributes(db, 'ent_ex', minimal)

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/bibles/ent_ex/export.md',
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await exportMdRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.headers['Content-Type']).toMatch(/text\/markdown/)
    expect(String(out.body)).toMatch(/^## Demographics/m)
  })

  it('GET export.md renders missing fields for an incomplete live projection', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createEntity(db, { id: 'ent_empty_export', type: 'character', name: 'Empty Export' })

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/bibles/ent_empty_export/export.md',
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await exportMdRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.headers['Content-Type']).toMatch(/text\/markdown/)
    expect(String(out.body)).toMatch(/^## Demographics/m)
    expect(String(out.body)).toContain('Missing required field')
  })

  it('GET export.pdf returns application/pdf buffer', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createEntity(db, { id: 'ent_pdf', type: 'character', name: 'P' })
    const minimal = {
      demographics: { gender: 'f', ageRange: '30s', eraLabel: 'Y', housingNotes: 'Z' },
      physical: {
        height: 'short',
        build: 'wide',
        face: 'round',
        eyes: 'brown',
        nose: 'wide',
        lips: 'thin',
        skin: 'dark',
      },
      visuals: { portraitBrief: 'y', continuityKeywords: ['a'] },
    }
    seedFixtureAttributes(db, 'ent_pdf', minimal)

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/bibles/ent_pdf/export.pdf',
    })

    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await exportPdfRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }

    expect(out.status).toBe(200)
    expect(out.headers['Content-Type']).toBe('application/pdf')
    expect(Buffer.isBuffer(out.body)).toBe(true)
    expect(/** @type {Buffer} */ (out.body).length).toBeGreaterThan(100)
    expect(/** @type {Buffer} */ (out.body).subarray(0, 4).toString()).toBe('%PDF')
  })

  it('returns 404 for unknown entity (markdown)', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: '/api/bibles/missing-ent/export.md',
    })
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await exportMdRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
    expect(out.status).toBe(404)
    expect(JSON.parse(String(out.body)).error).toMatch(/entity/i)
  })

  it('returns 404 when snapshot is missing', async () => {
    const dbPath = tempDbPath()
    openDb(dbPath)
    const { res, out } = mockRes()
    const fakeId = randomUUID()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: `/api/bibles/some-entity/export.md?snapshotId=${fakeId}`,
    })
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await exportMdRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
    expect(out.status).toBe(404)
    expect(JSON.parse(String(out.body)).error).toMatch(/snapshot/i)
  })

  it('returns 404 when snapshot belongs to another entity', async () => {
    const dbPath = tempDbPath()
    const db = openDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'A' })
    createEntity(db, { id: 'ent_b', type: 'character', name: 'B' })
    const minimal = {
      demographics: { gender: 'm', ageRange: '20s', eraLabel: 'E', housingNotes: 'H' },
      physical: {
        height: 'tall',
        build: 'slim',
        face: 'oval',
        eyes: 'blue',
        nose: 'small',
        lips: 'full',
        skin: 'light',
      },
      visuals: { portraitBrief: 'p', continuityKeywords: [] },
    }
    seedFixtureAttributes(db, 'ent_a', minimal)
    const snap = createBibleSnapshot(db, {
      entityId: 'ent_a',
      label: 'v',
      bibleJson: projectCharacterBible(db, 'ent_a'),
    })

    const { res, out } = mockRes()
    const req = /** @type {import('http').IncomingMessage} */ ({
      method: 'GET',
      url: `/api/bibles/ent_b/export.md?snapshotId=${snap.id}`,
    })
    const orig = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      await exportMdRoute.handler(req, res)
    } finally {
      if (orig === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = orig
    }
    expect(out.status).toBe(404)
  })
})
