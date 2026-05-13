import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { clearCachedToolRegistry, invokeRegisteredTool } from './httpInvoke.js'

const tempDirs = []
const openDbs = []

afterEach(() => {
  clearCachedToolRegistry()
  while (openDbs.length) {
    try {
      openDbs.pop().close()
    } catch {}
  }
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function openTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-detect-gaps-tool-'))
  tempDirs.push(dir)
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath: path.join(dir, 't.sqlite') })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

describe('detect-gaps tool', () => {
  it('returns gaps via registry invoke', async () => {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-dgt-')), 'db.sqlite')
    tempDirs.push(path.dirname(dbPath))
    const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio', SQLITE_DB_PATH: dbPath } })
    initializeDatabase(db)
    createEntity(db, { id: 'ent_gap', type: 'character', name: 'X' })
    db.close()

    const prev = process.env.SQLITE_DB_PATH
    process.env.SQLITE_DB_PATH = dbPath
    try {
      const out = await invokeRegisteredTool(process.env, 'detect-gaps', { entityId: 'ent_gap' })
      expect(Array.isArray(out.gaps)).toBe(true)
      expect(out.gaps.some((g) => g.field === 'description')).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.SQLITE_DB_PATH
      else process.env.SQLITE_DB_PATH = prev
    }
  })
})
