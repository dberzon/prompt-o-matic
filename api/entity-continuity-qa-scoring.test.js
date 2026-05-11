import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityContinuityQaScoringHandler from './entity-continuity-qa-scoring.js'
import { buildContinuityQaScoringSheet } from './lib/continuity/continuityQaHarness.js'
import { createEntity } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-continuity-qa-scoring-route-test-'))
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

describe('entity continuity QA scoring routes', () => {
  it('returns a blind scoring sheet and evaluates submitted scores', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ruslan_levashov', type: 'character', name: 'Ruslan Levashov' })

    const sheetRes = mockRes()
    await entityContinuityQaScoringHandler({
      method: 'GET',
      url: '/api/entities/ruslan_levashov/continuity-qa/scoring-sheet',
    }, sheetRes)
    expect(sheetRes.statusCode).toBe(200)
    expect(sheetRes.payload.scenes).toHaveLength(5)
    expect(sheetRes.payload.scenes[0].seedHidden).toBe(true)

    const scoringSheet = buildContinuityQaScoringSheet()
    scoringSheet.scenes = scoringSheet.scenes.map((scene) => ({
      ...scene,
      scores: { face: 4, body: 4, wardrobe: 4 },
      seedHidden: true,
    }))

    const scoreRes = mockRes()
    await entityContinuityQaScoringHandler({
      method: 'POST',
      url: '/api/entities/ruslan_levashov/continuity-qa/scores',
      body: { scoringSheet },
    }, scoreRes)
    expect(scoreRes.statusCode).toBe(200)
    expect(scoreRes.payload.outcome).toBe('accepted')
  })
})
