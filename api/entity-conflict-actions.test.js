import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityConflictActionsHandler from './entity-conflict-actions.js'
import { createEntity, getAttribute, writeAttribute } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-entity-conflict-action-test-'))
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

describe('entity conflict action routes', () => {
  it('resolves and dismisses S6 conflict markers', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_conflict', type: 'character', name: 'Ruslan' })
    const first = writeAttribute(db, {
      entityId: 'ent_conflict',
      key: 'eyes',
      value: 'green',
      provenance: 'inferred',
    })
    const second = writeAttribute(db, {
      entityId: 'ent_conflict',
      key: 'eyes',
      value: 'blue',
      provenance: 'inferred',
    })
    const conflict = writeAttribute(db, {
      entityId: 'ent_conflict',
      key: 'conflict.eyes',
      value: {
        message: 'Conflicting eye color',
        attributeIds: [first.id, second.id],
      },
      provenance: 'suggested',
      sourceStage: 6,
    })

    const resolveRes = mockRes()
    await entityConflictActionsHandler({
      method: 'POST',
      url: `/api/entities/ent_conflict/conflicts/${conflict.id}/resolve`,
      body: { winningAttributeId: first.id },
    }, resolveRes)
    expect(resolveRes.statusCode).toBe(200)
    expect(getAttribute(db, second.id).supersededBy).toBe(first.id)
    expect(getAttribute(db, conflict.id).dismissedAt).toBeTruthy()

    const nextConflict = writeAttribute(db, {
      entityId: 'ent_conflict',
      key: 'conflict.wardrobe',
      value: {
        message: 'Conflicting wardrobe',
        attributeIds: [first.id, second.id],
      },
      provenance: 'suggested',
      sourceStage: 6,
    })
    const dismissRes = mockRes()
    await entityConflictActionsHandler({
      method: 'POST',
      url: `/api/entities/ent_conflict/conflicts/${nextConflict.id}/dismiss`,
    }, dismissRes)
    expect(dismissRes.statusCode).toBe(200)
    expect(getAttribute(db, nextConflict.id).dismissedAt).toBeTruthy()
  })
})
