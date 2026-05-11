import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityMvpDoneGateHandler from './entity-mvp-done-gate.js'
import { createEntity, createVisualAnchor, writeAttribute } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'
import { MVP_DONE_GATE_MIN_CANON_ATTRIBUTES } from './lib/continuity/mvpDoneGate.js'

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

function seedReadyEntity(db) {
  createEntity(db, { id: 'ruslan_levashov', type: 'character', name: 'Ruslan Levashov' })
  createEntity(db, { id: 'communal_apartment', type: 'environment', name: 'Communal apartment' })
  createVisualAnchor(db, {
    id: 'anchor_primary',
    entityId: 'ruslan_levashov',
    type: 'reference_image',
    payload: Buffer.from('png'),
    isPrimary: true,
  })
  writeAttribute(db, {
    entityId: 'ruslan_levashov',
    key: 'visual.descriptor',
    value: 'frontal portrait, neutral expression',
    provenance: 'inferred',
    sourceStage: 5,
  })
  for (let index = 0; index < MVP_DONE_GATE_MIN_CANON_ATTRIBUTES; index += 1) {
    writeAttribute(db, {
      entityId: 'ruslan_levashov',
      key: `canon.${index}`,
      value: `value-${index}`,
      provenance: 'canon',
    })
  }
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
