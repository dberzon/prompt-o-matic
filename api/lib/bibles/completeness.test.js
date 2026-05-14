import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { getBibleCompleteness } from './completeness.js'
import { EntityNotFoundError } from './projection.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bible-completeness-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} fixture
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

const ruslanCharacterBibleFixture = {
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
}

describe('getBibleCompleteness', () => {
  it('throws EntityNotFoundError when entity is missing', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    expect(() => getBibleCompleteness(db, 'missing-entity-id')).toThrow(EntityNotFoundError)
  })

  it('zero-attribute character: ratio 0 and lists every required + recommended leaf', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_empty', type: 'character', name: 'Nobody' })
    const r = getBibleCompleteness(db, 'ent_empty')
    expect(r.ratio).toBe(0)
    expect(r.presentRequired).toBe(0)
    expect(r.presentRecommended).toBe(0)
    expect(r.requiredCount).toBe(r.missingRequired.length)
    expect(r.recommendedCount).toBe(r.missingRecommended.length)
    expect(r.missingRequired.map((x) => `${x.section}.${x.field}`).sort()).toEqual(
      [
        'demographics.ageRange',
        'demographics.eraLabel',
        'demographics.gender',
        'physical.build',
        'physical.eyes',
        'physical.face',
        'physical.height',
        'physical.lips',
        'physical.nose',
        'physical.skin',
        'visuals.portraitBrief',
      ].sort(),
    )
  })

  it('fully seeded character fixture: ratio 1 and no gaps', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_full', type: 'character', name: 'Ruslan' })
    seedFixtureAttributes(db, 'ent_full', ruslanCharacterBibleFixture)
    const r = getBibleCompleteness(db, 'ent_full')
    expect(r.ratio).toBe(1)
    expect(r.missingRequired).toEqual([])
    expect(r.missingRecommended).toEqual([])
    expect(r.presentRequired).toBe(r.requiredCount)
    expect(r.presentRecommended).toBe(r.recommendedCount)
  })

  it('required-only fixture: missingRequired empty, ratio below 1, exact weighted ratio', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_partial', type: 'character', name: 'Min' })
    const minimal = {
      demographics: { gender: 'nb', ageRange: '40s', eraLabel: 'Present', housingNotes: 'Unknown.' },
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
    seedFixtureAttributes(db, 'ent_partial', minimal)
    const r = getBibleCompleteness(db, 'ent_partial')
    expect(r.missingRequired).toEqual([])
    expect(r.presentRequired).toBe(r.requiredCount)
    expect(r.recommendedCount).toBeGreaterThan(0)
    expect(r.presentRecommended).toBe(0)
    expect(r.ratio).toBeLessThan(1)
    const expected = r.presentRequired / (r.requiredCount + r.recommendedCount * 0.5)
    expect(r.ratio).toBeCloseTo(expected, 10)
    expect(r.missingRecommended.length).toBeGreaterThan(0)
  })
})
