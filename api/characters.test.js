import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import handler from './characters.js'
import { validCharacterProfile } from './lib/characters/fixtures.js'
import { createCharacter, getCharacter } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-characters-route-test-'))
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
  delete process.env.ENABLE_CHARACTER_BATCH_API
  delete process.env.APP_MODE
})

describe('characters route', () => {
  it('blocks character deletes in cloud mode without removing the record', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_CHARACTER_BATCH_API = 'true'
    process.env.APP_MODE = 'cloud'

    const db = ensureDb(dbPath)
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_delete_cloud_blocked',
    })

    const res = mockRes()
    await handler({ method: 'DELETE', query: { id: 'char_delete_cloud_blocked' } }, res)

    expect(res.statusCode).toBe(403)
    expect(res.payload.error).toContain('blocked in APP_MODE=cloud')
    expect(getCharacter(db, 'char_delete_cloud_blocked')).not.toBeNull()
  })

  it('deletes characters in local studio mode', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_CHARACTER_BATCH_API = 'true'
    process.env.APP_MODE = 'local-studio'

    const db = ensureDb(dbPath)
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_delete_local_allowed',
    })

    const res = mockRes()
    await handler({ method: 'DELETE', query: { id: 'char_delete_local_allowed' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.ok).toBe(true)
    expect(getCharacter(db, 'char_delete_local_allowed')).toBeNull()
  })
})
