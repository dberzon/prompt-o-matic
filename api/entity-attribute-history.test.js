import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityAttributeHistoryHandler from './entity-attribute-history.js'
import { createEntity, listAttributeSupersedeChain, writeAttribute } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-entity-attribute-history-test-'))
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

describe('entity attribute history routes', () => {
  it('returns supersede chain oldest to newest with current head', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_hist', type: 'character', name: 'Ruslan' })
    const first = writeAttribute(db, {
      entityId: 'ent_hist',
      key: 'eyes',
      value: 'brown',
      provenance: 'canon',
    })
    const second = writeAttribute(db, {
      entityId: 'ent_hist',
      key: 'eyes',
      value: 'green',
      provenance: 'canon',
      supersedes: first.id,
    })

    const chain = listAttributeSupersedeChain(db, { entityId: 'ent_hist', attributeId: first.id })
    expect(chain?.currentAttributeId).toBe(second.id)
    expect(chain?.items.map((item) => item.value)).toEqual(['brown', 'green'])

    const res = mockRes()
    await entityAttributeHistoryHandler({
      method: 'GET',
      url: `/api/entities/ent_hist/attributes/${first.id}/history`,
    }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.currentAttributeId).toBe(second.id)
    expect(res.payload.items).toHaveLength(2)
  })
})
