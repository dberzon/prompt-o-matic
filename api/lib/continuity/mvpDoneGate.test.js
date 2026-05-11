import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, createVisualAnchor, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { buildContinuityQaScoringSheet } from './continuityQaHarness.js'
import {
  assessMvpDoneGateReadiness,
  evaluateMvpDoneGate,
  MVP_DONE_GATE_MIN_CANON_ATTRIBUTES,
} from './mvpDoneGate.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-mvp-done-gate-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
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
})

describe('MVP Done gate readiness', () => {
  it('requires character, environment, anchor, descriptor, and canon attrs', () => {
    const db = createTempDb()
    createEntity(db, { id: 'ruslan_levashov', type: 'character', name: 'Ruslan Levashov' })
    createEntity(db, { id: 'communal_apartment', type: 'environment', name: 'Communal apartment' })
    createVisualAnchor(db, {
      id: 'anchor_primary',
      entityId: 'ruslan_levashov',
      type: 'reference_image',
      payload: Buffer.from('png'),
      isPrimary: true,
    })
    writeAttribute(db, {
      entityId: 'ruslan_levashov',
      key: 'visual.descriptor',
      value: 'frontal portrait, neutral expression',
      provenance: 'inferred',
      sourceStage: 5,
    })
    for (let index = 0; index < MVP_DONE_GATE_MIN_CANON_ATTRIBUTES; index += 1) {
      writeAttribute(db, {
        entityId: 'ruslan_levashov',
        key: `canon.${index}`,
        value: `value-${index}`,
        provenance: 'canon',
      })
    }

    const readiness = assessMvpDoneGateReadiness(db, 'ruslan_levashov')
    expect(readiness.ready).toBe(true)
    expect(readiness.checks.every((check) => check.met)).toBe(true)
  })

  it('evaluates reviewer scores against the Section 4 threshold', () => {
    const sheet = buildContinuityQaScoringSheet()
    sheet.scenes = sheet.scenes.map((scene) => ({
      ...scene,
      scores: { face: 4, body: 4, wardrobe: 4 },
      seedHidden: true,
    }))
    const result = evaluateMvpDoneGate(sheet)
    expect(result.accepted).toBe(true)
    expect(result.outcome).toBe('accepted')
  })
})
