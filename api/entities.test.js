import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entitiesHandler from './entities.js'
import { getEntity, listEntities } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-entities-route-test-'))
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

describe('entities routes', () => {
  it('creates, reads, updates, archives, and lists entities', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    ensureDb(dbPath)

    const createRes = mockRes()
    await entitiesHandler({
      method: 'POST',
      url: '/api/entities',
      body: { id: 'ent_route_1', type: 'character', name: 'Ruslan' },
    }, createRes)
    expect(createRes.statusCode).toBe(200)
    expect(createRes.payload.item.id).toBe('ent_route_1')

    const getRes = mockRes()
    await entitiesHandler({ method: 'GET', url: '/api/entities/ent_route_1' }, getRes)
    expect(getRes.statusCode).toBe(200)
    expect(getRes.payload.item.name).toBe('Ruslan')

    const updateRes = mockRes()
    await entitiesHandler({
      method: 'PUT',
      url: '/api/entities/ent_route_1',
      body: { name: 'Ruslan Levashov' },
    }, updateRes)
    expect(updateRes.statusCode).toBe(200)
    expect(updateRes.payload.item.name).toBe('Ruslan Levashov')

    const deleteRes = mockRes()
    await entitiesHandler({ method: 'DELETE', url: '/api/entities/ent_route_1' }, deleteRes)
    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.payload.archived).toBe(true)

    const db = openDbs[0]
    expect(getEntity(db, 'ent_route_1').archivedAt).toBeTruthy()
    expect(listEntities(db).map((item) => item.id)).not.toContain('ent_route_1')
    expect(listEntities(db, { includeArchived: true }).map((item) => item.id)).toContain('ent_route_1')
  })

  it('filters list results by type', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    ensureDb(dbPath)

    await entitiesHandler({
      method: 'POST',
      url: '/api/entities',
      body: { id: 'ent_char', type: 'character', name: 'C1' },
    }, mockRes())
    await entitiesHandler({
      method: 'POST',
      url: '/api/entities',
      body: { id: 'ent_env', type: 'environment', name: 'Wharf' },
    }, mockRes())

    const listRes = mockRes()
    await entitiesHandler({ method: 'GET', url: '/api/entities?type=environment' }, listRes)
    expect(listRes.statusCode).toBe(200)
    expect(listRes.payload.items.map((item) => item.id)).toEqual(['ent_env'])
  })
})
