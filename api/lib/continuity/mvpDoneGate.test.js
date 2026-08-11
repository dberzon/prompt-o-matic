import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getBibleCompleteness } from '../bibles/completeness.js'
import { createEntity, createVisualAnchor, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { buildContinuityQaScoringSheet } from './continuityQaHarness.js'
import {
  assessMvpDoneGateReadiness,
  evaluateMvpDoneGate,
  MVP_DONE_GATE_MIN_CANON_ATTRIBUTES,
  MVP_DONE_GATE_MIN_COMPLETENESS_RATIO,
  runMvpDoneGateContinuityQa,
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

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {Record<string, unknown>} fixture
 */
function seedFixtureAttributes(db, entityId, fixture) {
  /**
   * @param {string} prefix
   * @param {unknown} value
   */
  function walk(prefix, value) {
    if (Array.isArray(value)) {
      writeAttribute(db, { entityId, key: prefix, value, provenance: 'canon' })
      return
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        const next = prefix ? `${prefix}.${k}` : k
        walk(next, v)
      }
      return
    }
    writeAttribute(db, { entityId, key: prefix, value, provenance: 'canon' })
  }
  for (const [k, v] of Object.entries(fixture)) {
    walk(k, v)
  }
}

function seedSharedGateRows(db, entityId) {
  createEntity(db, { id: entityId, type: 'character', name: 'Test Character' })
  createEntity(db, { id: 'communal_apartment', type: 'environment', name: 'Communal apartment' })
  createVisualAnchor(db, {
    id: 'anchor_primary',
    entityId,
    type: 'reference_image',
    payload: Buffer.from('png'),
    isPrimary: true,
  })
  writeAttribute(db, {
    entityId,
    key: 'visual.descriptor',
    value: 'frontal portrait, neutral expression',
    provenance: 'inferred',
    sourceStage: 5,
  })
}

/** Required leaves only; ratio ~0.71 (below 0.75). */
const minimalCharacterBible = {
  demographics: {
    gender: 'nb',
    ageRange: '40s',
    eraLabel: 'Present',
    housingNotes: 'Unknown.',
  },
  physical: {
    height: 'medium',
    build: 'stocky',
    face: 'square',
    eyes: 'hazel',
    nose: 'wide',
    lips: 'thin',
    skin: 'fair',
  },
  visuals: { portraitBrief: 'bust', continuityKeywords: [] },
}

/** One extra recommended leaf; ratio ~0.742 (still below 0.75). */
const almostThresholdBible = {
  ...minimalCharacterBible,
  wardrobe: { everyday: 'jeans' },
}

/** Two extra recommended leaves; ratio ~0.774 (≥ 0.75). */
const aboveThresholdBible = {
  ...minimalCharacterBible,
  wardrobe: { everyday: 'jeans' },
  history: { biographySummary: 'A long enough biography summary for the character.' },
}

afterEach(() => {
  delete process.env.QPB_MVP_GATE_USE_COMPLETENESS
  delete process.env.QPB_MVP_GATE_MIN_COMPLETENESS_RATIO
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
  it(`rejects Bible completeness below ${MVP_DONE_GATE_MIN_COMPLETENESS_RATIO} (ratio ~0.74)`, () => {
    const db = createTempDb()
    const entityId = 'ruslan_levashov'
    seedSharedGateRows(db, entityId)
    seedFixtureAttributes(db, entityId, almostThresholdBible)
    const c = getBibleCompleteness(db, entityId)
    expect(c.ratio).toBeLessThan(MVP_DONE_GATE_MIN_COMPLETENESS_RATIO)

    const readiness = assessMvpDoneGateReadiness(db, entityId)
    expect(readiness.ready).toBe(false)
    const bible = readiness.checks.find((ch) => ch.id === 'bible_completeness')
    expect(bible?.met).toBe(false)
    expect(String(bible?.detail)).toMatch(/ratio 0\.\d+ \(need ≥/)
    expect(String(bible?.detail)).toMatch(/missing recommended/)
  })

  it(`accepts Bible completeness at or above ${MVP_DONE_GATE_MIN_COMPLETENESS_RATIO}`, () => {
    const db = createTempDb()
    const entityId = 'ruslan_levashov'
    seedSharedGateRows(db, entityId)
    seedFixtureAttributes(db, entityId, aboveThresholdBible)
    const c = getBibleCompleteness(db, entityId)
    expect(c.ratio).toBeGreaterThanOrEqual(MVP_DONE_GATE_MIN_COMPLETENESS_RATIO)

    const readiness = assessMvpDoneGateReadiness(db, entityId)
    expect(readiness.ready).toBe(true)
    expect(readiness.checks.every((check) => check.met)).toBe(true)
    const bible = readiness.checks.find((ch) => ch.id === 'bible_completeness')
    expect(bible?.met).toBe(true)
    expect(String(bible?.detail)).toMatch(/≥/)
  })

  it('rejects when weighted ratio clears the threshold but required Bible leaves are still missing', () => {
    const db = createTempDb()
    const entityId = 'sparse_required'
    seedSharedGateRows(db, entityId)
    // All demographics + most physical, skip eyes/nose; flood recommended leaves so ratio ≥ 0.75.
    seedFixtureAttributes(db, entityId, {
      demographics: {
        gender: 'm',
        ageRange: '20s',
        eraLabel: 'Present',
        housingNotes: 'Unknown.',
      },
      physical: {
        height: 'medium',
        build: 'stocky',
        face: 'square',
        lips: 'thin',
        skin: 'fair',
      },
      wardrobe: { everyday: 'jeans', accessories: ['belt'] },
      voice: { dialogueDeliveryNotes: 'dry', accentOrDiction: 'local' },
      psychology: { temperament: 'wry', motivations: 'study' },
      history: {
        biographySummary: 'A long enough biography summary for the character.',
        educationOrWork: 'college',
        habits: 'smokes',
      },
      relationships: [{ slug: 'rita', label: 'Rita', nature: 'friend' }],
      visuals: { portraitBrief: 'bust', continuityKeywords: ['freckles'] },
    })
    const c = getBibleCompleteness(db, entityId)
    expect(c.ratio).toBeGreaterThanOrEqual(MVP_DONE_GATE_MIN_COMPLETENESS_RATIO)
    expect(c.missingRequired.map((r) => `${r.section}.${r.field}`)).toEqual(
      expect.arrayContaining(['physical.eyes', 'physical.nose']),
    )

    const readiness = assessMvpDoneGateReadiness(db, entityId)
    expect(readiness.ready).toBe(false)
    const bible = readiness.checks.find((ch) => ch.id === 'bible_completeness')
    expect(bible?.met).toBe(false)
    expect(String(bible?.detail)).toMatch(/missing required:/)
    expect(bible?.missingRequiredFields).toEqual(
      expect.arrayContaining(['physical.eyes', 'physical.nose']),
    )
  })

  it('accepts fully seeded character Bible at ratio 1.0', () => {
    const db = createTempDb()
    const entityId = 'ent_full'
    seedSharedGateRows(db, entityId)
    seedFixtureAttributes(db, entityId, {
      demographics: {
        gender: 'male',
        ageRange: '20-25',
        eraLabel: 'Perestroika',
        housingNotes: 'Communal apartment on the outskirts of Moscow; lives with mother and disabled sister.',
      },
      physical: {
        height: 'short',
        build: 'heavy-built, wide shoulders, slight belly',
        face: 'rounded childish face',
        eyes: 'piggy eyes',
        nose: 'short upturned nose',
        lips: 'thin lips',
        skin: 'freckles',
      },
      wardrobe: {
        everyday: 'Student wear; worn student jacket',
        accessories: ['Belomorkanal cigarettes'],
      },
      voice: {
        dialogueDeliveryNotes: 'Dry with friends during smoke breaks.',
        accentOrDiction: 'Moscow outskirts vernacular (light).',
      },
      psychology: {
        temperament: 'wry and loyal',
        motivations: 'Studies mechanical engineering; in love with Rita Vlasova from pedagogical college.',
      },
      history: {
        biographySummary: 'Long bio text for Ruslan.',
        educationOrWork: 'Mechanical engineering student at technical college.',
        habits: 'Smokes with friends during breaks; drinks in Soviet beer halls on Fridays.',
      },
      relationships: [
        { slug: 'rita_vlasova', label: 'Rita Vlasova', nature: 'romantic interest' },
        { slug: 'ruslan_mother', label: 'mother', nature: 'co-habiting family' },
      ],
      visuals: {
        portraitBrief: 'frontal portrait, neutral expression, plain backdrop, freckled face',
        continuityKeywords: ['freckles', 'piggy eyes'],
      },
    })
    expect(getBibleCompleteness(db, entityId).ratio).toBe(1)
    const readiness = assessMvpDoneGateReadiness(db, entityId)
    expect(readiness.ready).toBe(true)
  })

  it('lists missing required fields when required Bible leaves are absent', () => {
    const db = createTempDb()
    const entityId = 'thin_char'
    seedSharedGateRows(db, entityId)
    const readiness = assessMvpDoneGateReadiness(db, entityId)
    expect(readiness.ready).toBe(false)
    const bible = readiness.checks.find((ch) => ch.id === 'bible_completeness')
    expect(String(bible?.detail)).toMatch(/missing required:/)
    expect(bible?.missingRequiredFields?.length).toBeGreaterThan(0)
  })

  it('legacy mode: QPB_MVP_GATE_USE_COMPLETENESS=0 uses ≥12 canon rows', () => {
    process.env.QPB_MVP_GATE_USE_COMPLETENESS = '0'
    const db = createTempDb()
    const entityId = 'ruslan_levashov'
    seedSharedGateRows(db, entityId)
    for (let index = 0; index < MVP_DONE_GATE_MIN_CANON_ATTRIBUTES; index += 1) {
      writeAttribute(db, {
        entityId,
        key: `canon.${index}`,
        value: `value-${index}`,
        provenance: 'canon',
      })
    }
    const readiness = assessMvpDoneGateReadiness(db, entityId)
    expect(readiness.ready).toBe(true)
    expect(readiness.checks.some((c) => c.id === 'canon_attributes' && c.met)).toBe(true)
  })

  it('prerequisite error message includes Bible gap detail (not generic attribute count)', async () => {
    const db = createTempDb()
    const entityId = 'ruslan_levashov'
    seedSharedGateRows(db, entityId)
    seedFixtureAttributes(db, entityId, almostThresholdBible)

    await expect(
      runMvpDoneGateContinuityQa({
        db,
        entityId,
        comfyService: {},
        input: {},
      }),
    ).rejects.toMatchObject({
      message: /ratio 0\.\d+ \(need ≥/,
      status: 422,
    })
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
