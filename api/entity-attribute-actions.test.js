import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityAttributeActionsHandler from './entity-attribute-actions.js'
import { createEntity, getAttribute, writeAttribute } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-entity-attr-action-test-'))
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

describe('entity attribute action routes', () => {
  it('promotes, edits, and dismisses attributes for an entity', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'Ruslan' })
    const inferred = writeAttribute(db, {
      entityId: 'ent_a',
      key: 'eyes',
      value: 'blue',
      provenance: 'inferred',
    })
    const suggested = writeAttribute(db, {
      entityId: 'ent_a',
      key: 'mood',
      value: 'wistful',
      provenance: 'suggested',
    })

    const promoteRes = mockRes()
    await entityAttributeActionsHandler({
      method: 'POST',
      url: `/api/entities/ent_a/attributes/${inferred.id}/promote`,
    }, promoteRes)
    expect(promoteRes.statusCode).toBe(200)
    expect(promoteRes.payload.item.provenance).toBe('canon')
    expect(getAttribute(db, inferred.id).supersededBy).toBe(promoteRes.payload.item.id)

    const editRes = mockRes()
    await entityAttributeActionsHandler({
      method: 'POST',
      url: `/api/entities/ent_a/attributes/${suggested.id}/edit`,
      body: { value: 'quiet' },
    }, editRes)
    expect(editRes.statusCode).toBe(200)
    expect(editRes.payload.item.provenance).toBe('canon')
    expect(editRes.payload.item.value).toBe('quiet')

    const dismissRes = mockRes()
    await entityAttributeActionsHandler({
      method: 'POST',
      url: `/api/entities/ent_a/attributes/${suggested.id}/dismiss`,
    }, dismissRes)
    expect(dismissRes.statusCode).toBe(200)
    expect(dismissRes.payload.item.dismissedAt).toBeTruthy()
  })
})
