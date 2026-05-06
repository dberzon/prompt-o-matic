import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import planHandler from '../../character-portfolio-plan.js'
import queueHandler from '../../character-portfolio-queue.js'
import { createCharacter } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { validCharacterProfile } from '../characters/fixtures.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-portfolio-route-test-'))
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
  delete process.env.ENABLE_PROMPT_PACK_API
  delete process.env.ENABLE_COMFY_API
  delete process.env.APP_MODE
})

describe('character portfolio routes', () => {
  it('plan route works without comfy flag', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_PROMPT_PACK_API = 'true'
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createCharacter(db, { ...validCharacterProfile, id: 'char_portfolio_route_1' })
    const res = mockRes()
    await planHandler({
      method: 'POST',
      body: {
        characterId: 'char_portfolio_route_1',
        views: ['front_portrait'],
        workflowId: 'qwen-image-2512-default',
        options: { persistPromptPacks: true, aspectRatio: '2:3' },
      },
    }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.ok).toBe(true)
  })

  it('queue route requires comfy guard in cloud mode', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_PROMPT_PACK_API = 'true'
    process.env.APP_MODE = 'cloud'
    const db = ensureDb(dbPath)
    createCharacter(db, { ...validCharacterProfile, id: 'char_portfolio_route_2' })
    const res = mockRes()
    await queueHandler({
      method: 'POST',
      body: {
        characterId: 'char_portfolio_route_2',
        views: ['front_portrait'],
        workflowId: 'qwen-image-2512-default',
      },
    }, res)
    expect(res.statusCode).toBe(403)
  })
})

