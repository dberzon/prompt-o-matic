import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { detectEntityBibleGaps, suggestedStageForBibleField } from './detectGaps.js'

const tempDirs = []
const openDbs = []

afterEach(() => {
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-detect-gaps-'))
  tempDirs.push(dir)
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath: path.join(dir, 't.sqlite') })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

describe('suggestedStageForBibleField', () => {
  it('maps character demographics and visuals to S1/S2/S5', () => {
    expect(suggestedStageForBibleField('character', 'demographics', 'gender')).toBe(1)
    expect(suggestedStageForBibleField('character', 'demographics', 'eraLabel')).toBe(2)
    expect(suggestedStageForBibleField('character', 'visuals', 'portraitBrief')).toBe(5)
  })
})

describe('detectEntityBibleGaps', () => {
  it('returns error gap when entity is missing', () => {
    const db = openTempDb()
    const gaps = detectEntityBibleGaps(db, 'missing')
    expect(gaps).toHaveLength(1)
    expect(gaps[0].field).toBe('entity')
    expect(gaps[0].suggestedStageId).toBeNull()
  })

  it('returns description gap with suggested stage 1 when missing', () => {
    const db = openTempDb()
    createEntity(db, { id: 'e1', type: 'character', name: 'Hero' })
    const gaps = detectEntityBibleGaps(db, 'e1')
    expect(gaps.some((g) => g.field === 'description' && g.suggestedStageId === 1)).toBe(true)
    expect(gaps.some((g) => g.field === 'demographics.gender' && g.suggestedStageId === 1)).toBe(true)
    expect(gaps.some((g) => g.field === 'visuals.portraitBrief' && g.suggestedStageId === 5)).toBe(true)
  })

  it('after bank lift (description only), still reports missing required bible fields', () => {
    const db = openTempDb()
    createEntity(db, { id: 'e2', type: 'character', name: 'Hero' })
    writeAttribute(db, {
      entityId: 'e2',
      key: 'description',
      value: 'Has text',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 'lift',
    })
    const gaps = detectEntityBibleGaps(db, 'e2')
    expect(gaps.some((g) => g.field === 'description')).toBe(false)
    expect(gaps.some((g) => g.field === 'demographics.gender')).toBe(true)
    expect(gaps.length).toBeGreaterThan(5)
  })
})
