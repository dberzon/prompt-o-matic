import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityMvpDoneGateHandler from './entity-mvp-done-gate.js'
import { createEntity, createVisualAnchor, writeAttribute } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-mvp-done-gate-route-test-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(obj) { this.payload = obj; return this },
    writeHead() {},
    end() {},
  }
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

function seedReadyEntity(db) {
  const entityId = 'ruslan_levashov'
  createEntity(db, { id: entityId, type: 'character', name: 'Ruslan Levashov' })
  createEntity(db, { id: 'communal_apartment', type: 'environment', name: 'Communal apartment' })
  createVisualAnchor(db, {
    id: 'anchor_primary',
    entityId,
    type: 'reference_image',
    payload: Buffer.from('png'),
    isPrimary: true,
  })
  writeAttribute(db, {
    entityId,
    key: 'visual.descriptor',
    value: 'frontal portrait, neutral expression',
    provenance: 'inferred',
    sourceStage: 5,
  })
  const minimalCharacterBible = {
    demographics: {
      gender: 'nb',
      ageRange: '40s',
      eraLabel: 'Present',
      housingNotes: 'Unknown.',
    },
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
  const aboveThresholdBible = {
    ...minimalCharacterBible,
    wardrobe: { everyday: 'jeans' },
    history: { biographySummary: 'A long enough biography summary for the character.' },
  }
  seedFixtureAttributes(db, entityId, aboveThresholdBible)
}

afterEach(() => {
  while (openDbs.length > 0) {
    try {
      openDbs.pop().close()
    } catch {}
  }
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
  delete process.env.SQLITE_DB_PATH
  delete process.env.APP_MODE
})

describe('entity MVP Done gate route', () => {
  it('returns readiness checks for an entity', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    seedReadyEntity(db)

    const res = mockRes()
    await entityMvpDoneGateHandler({
      method: 'GET',
      url: '/api/entities/ruslan_levashov/mvp-done-gate',
    }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.ready).toBe(true)
    expect(res.payload.checks).toHaveLength(5)
  })
})
