import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityRelationshipsHandler from './entity-relationships.js'
import { createEntity, listRelationships } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-entity-rel-route-test-'))
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

describe('entity relationships routes', () => {
  it('creates, lists, updates, and deletes relationships scoped to an entity', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'Ruslan' })
    createEntity(db, { id: 'ent_b', type: 'character', name: 'Rita' })

    const createRes = mockRes()
    await entityRelationshipsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/relationships',
      body: {
        id: 'rel_route_1',
        toId: 'ent_b',
        type: 'romantic.crush',
        provenance: 'canon',
      },
    }, createRes)
    expect(createRes.statusCode).toBe(200)
    expect(createRes.payload.item.fromId).toBe('ent_a')

    const listRes = mockRes()
    await entityRelationshipsHandler({ method: 'GET', url: '/api/entities/ent_a/relationships' }, listRes)
    expect(listRes.statusCode).toBe(200)
    expect(listRes.payload.items.map((item) => item.id)).toEqual(['rel_route_1'])

    const getRes = mockRes()
    await entityRelationshipsHandler({ method: 'GET', url: '/api/entities/ent_a/relationships/rel_route_1' }, getRes)
    expect(getRes.statusCode).toBe(200)
    expect(getRes.payload.item.type).toBe('romantic.crush')

    const updateRes = mockRes()
    await entityRelationshipsHandler({
      method: 'PUT',
      url: '/api/entities/ent_a/relationships/rel_route_1',
      body: { provenance: 'inferred', confidence: 0.7 },
    }, updateRes)
    expect(updateRes.statusCode).toBe(200)
    expect(updateRes.payload.item.provenance).toBe('inferred')
    expect(updateRes.payload.item.confidence).toBe(0.7)

    const deleteRes = mockRes()
    await entityRelationshipsHandler({ method: 'DELETE', url: '/api/entities/ent_a/relationships/rel_route_1' }, deleteRes)
    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.payload.deleted).toBe(true)
    expect(listRelationships(db, { fromId: 'ent_a' })).toEqual([])
  })

  it('lists incoming relationships for the scoped entity', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'Ruslan' })
    createEntity(db, { id: 'ent_b', type: 'character', name: 'Rita' })

    await entityRelationshipsHandler({
      method: 'POST',
      url: '/api/entities/ent_b/relationships',
      body: {
        id: 'rel_incoming',
        toId: 'ent_a',
        type: 'social.friend',
        provenance: 'canon',
      },
    }, mockRes())

    const listRes = mockRes()
    await entityRelationshipsHandler({ method: 'GET', url: '/api/entities/ent_a/relationships' }, listRes)
    expect(listRes.payload.items.map((item) => item.id)).toEqual(['rel_incoming'])
  })
})
