import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import handler from './actor-more-takes.js'
import { createActorCandidate, createCharacter } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'
import { validCharacterProfile } from './lib/characters/fixtures.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-more-takes-test-'))
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
    try { openDbs.pop().close() } catch {}
  }
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
  delete process.env.SQLITE_DB_PATH
  delete process.env.ENABLE_PROMPT_PACK_API
  delete process.env.ENABLE_COMFY_API
  delete process.env.APP_MODE
})

describe('actor-more-takes handler', () => {
  it('returns 405 for non-POST requests', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 403 when neither prompt-pack nor comfy API flags are set', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { characterId: 'any' } }, res)
    expect(res.statusCode).toBe(403)
    // First guard hit is PROMPT_PACK_API_DISABLED (checked before Comfy guard).
    expect(res.payload.code).toBe('PROMPT_PACK_API_DISABLED')
  })

  it('returns 400 when neither characterId nor actorCandidateId is provided', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_PROMPT_PACK_API = 'true'
    process.env.ENABLE_COMFY_API = 'true'
    process.env.APP_MODE = 'local-studio'
    ensureDb(dbPath)
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.statusCode).toBe(400)
    expect(res.payload.error).toMatch(/characterId or actorCandidateId/)
  })

  it('returns 404 when actorCandidateId references a missing candidate', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_PROMPT_PACK_API = 'true'
    process.env.ENABLE_COMFY_API = 'true'
    process.env.APP_MODE = 'local-studio'
    ensureDb(dbPath)
    const res = mockRes()
    await handler({ method: 'POST', body: { actorCandidateId: 'nonexistent_id' } }, res)
    expect(res.statusCode).toBe(404)
  })

  it('resolves characterId from actorCandidateId via notes JSON, then reaches ComfyUI guard', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_PROMPT_PACK_API = 'true'
    process.env.ENABLE_COMFY_API = 'true'
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)

    createCharacter(db, { ...validCharacterProfile, id: 'char_takes_001' })
    const candidate = createActorCandidate(db, {
      status: 'available',
      notes: JSON.stringify({ characterId: 'char_takes_001', view: 'front_portrait' }),
    })

    const res = mockRes()
    await handler({ method: 'POST', body: { actorCandidateId: candidate.id, views: ['full_body'] } }, res)
    // characterId resolved correctly; request proceeds past validation and fails
    // at Comfy connectivity (no real ComfyUI in test), not at 404/400/422.
    expect(res.statusCode).not.toBe(400)
    expect(res.statusCode).not.toBe(404)
    expect(res.statusCode).not.toBe(422)
  })
})
