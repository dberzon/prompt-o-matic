import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RUSLAN_SOURCE_TEXT } from '../extrapolation/fixtures/ruslanWorkedExample.js'
import { createEntity, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { CharacterBibleSchema } from './schemas/characterBible.schema.js'
import { EraBibleSchema } from './schemas/eraBible.schema.js'
import { LocationBibleSchema } from './schemas/locationBible.schema.js'
import { PropBibleSchema } from './schemas/propBible.schema.js'
import {
  EntityNotFoundError,
  projectBible,
  projectBibleView,
  projectCharacterBible,
  projectEraBible,
  projectLocationBible,
  projectPropBible,
} from './projection.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bible-projection-'))
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
 * @param {Record<string, 'canon' | 'inferred' | 'derived' | 'suggested' | 'temporary'>} [provenanceByPath]
 */
function seedFixtureAttributes(db, entityId, fixture, provenanceByPath = {}) {
  /**
   * @param {string} prefix
   * @param {unknown} value
   */
  function walk(prefix, value) {
    if (Array.isArray(value)) {
      const prov = provenanceByPath[prefix] || 'canon'
      writeAttribute(db, { entityId, key: prefix, value, provenance: prov })
      return
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        const next = prefix ? `${prefix}.${k}` : k
        walk(next, v)
      }
      return
    }
    const prov = provenanceByPath[prefix] || 'canon'
    writeAttribute(db, { entityId, key: prefix, value, provenance: prov })
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
    biographySummary: RUSLAN_SOURCE_TEXT,
    educationOrWork: 'Mechanical engineering student at technical college.',
    habits: 'Smokes with friends during breaks; drinks in Soviet beer halls on Fridays.',
  },
  relationships: [
    { slug: 'rita_vlasova', label: 'Rita Vlasova', nature: 'romantic interest' },
    { slug: 'ruslan_mother', label: 'mother', nature: 'co-habiting family' },
    { slug: 'ruslan_sister', label: 'disabled sister', nature: 'co-habiting family' },
  ],
  visuals: {
    portraitBrief: 'frontal portrait, neutral expression, plain backdrop, freckled face',
    continuityKeywords: ['freckles', 'piggy eyes', 'short upturned nose'],
  },
}

describe('projectBible / projection', () => {
  it('throws EntityNotFoundError for a missing entity', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    expect(() => projectBible(db, 'missing-entity-id')).toThrow(EntityNotFoundError)
  })

  it('projectCharacterBible: full Ruslan-shaped attributes parse as CharacterBible and expose _provenance', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_ruslan', type: 'character', name: 'Ruslan' })
    const prov = {
      'demographics.gender': /** @type {const} */ ('canon'),
      'physical.height': /** @type {const} */ ('inferred'),
      'history.biographySummary': /** @type {const} */ ('derived'),
    }
    seedFixtureAttributes(db, 'ent_ruslan', ruslanCharacterBibleFixture, prov)
    const out = projectCharacterBible(db, 'ent_ruslan')
    const { _provenance, ...bible } = out
    CharacterBibleSchema.parse(bible)
    expect(_provenance['demographics.gender']).toBe('canon')
    expect(_provenance['physical.height']).toBe('inferred')
    expect(_provenance['history.biographySummary']).toBe('derived')
    expect(bible.demographics.gender).toBe('male')
  })

  it('projectCharacterBible: maps appearance.* and setting.era onto Bible paths', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_map', type: 'character', name: 'Test' })
    writeAttribute(db, { entityId: 'ent_map', key: 'appearance.height', value: 'tall', provenance: 'canon' })
    writeAttribute(db, { entityId: 'ent_map', key: 'setting.era', value: '1990s', provenance: 'inferred' })
    const minimal = {
      demographics: { gender: 'female', ageRange: '30s', housingNotes: 'City flat.' },
      physical: {
        build: 'average',
        face: 'oval',
        eyes: 'brown',
        nose: 'straight',
        lips: 'full',
        skin: 'olive',
      },
      visuals: { portraitBrief: 'mid-shot', continuityKeywords: ['neutral'] },
    }
    seedFixtureAttributes(db, 'ent_map', minimal)
    const out = projectCharacterBible(db, 'ent_map')
    const { _provenance, ...bible } = out
    CharacterBibleSchema.parse(bible)
    expect(bible.physical.height).toBe('tall')
    expect(bible.demographics.eraLabel).toBe('1990s')
    expect(_provenance['physical.height']).toBe('canon')
    expect(_provenance['demographics.eraLabel']).toBe('inferred')
  })

  it('projectCharacterBible: recommended-missing still validates (required sections only)', () => {
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
    const { _provenance, ...bible } = projectCharacterBible(db, 'ent_partial')
    CharacterBibleSchema.parse(bible)
    expect(bible.wardrobe).toBeUndefined()
    expect(Object.keys(_provenance).length).toBeGreaterThan(0)
  })

  it('projectLocationBible: happy path + identity.name from entity row', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_loc', type: 'location', name: 'Soviet apartment block' })
    const loc = {
      identity: {
        eraOrPeriod: '1989',
        summary: 'Brutalist panel housing; courtyard-facing unit.',
      },
      geography: {
        placement: 'Moscow periphery.',
        architecturalNotes: 'Prefabricated panels.',
      },
      function: { purposeInStory: 'Domestic pressure scenes.' },
      visuals: { shotPriority: 'Establishing wide.', moodKeywords: ['grey'] },
    }
    seedFixtureAttributes(db, 'ent_loc', loc)
    const { _provenance, ...bible } = projectLocationBible(db, 'ent_loc')
    LocationBibleSchema.parse(bible)
    expect(bible.identity.name).toBe('Soviet apartment block')
    expect(_provenance['identity.name']).toBe('canon')
  })

  it('projectEraBible: happy path', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_era', type: 'era', name: 'Soviet Perestroika 1985–1991' })
    writeAttribute(db, {
      entityId: 'ent_era',
      key: 'timeframe.spanDescription',
      value: '1985–1991',
      provenance: 'canon',
    })
    writeAttribute(db, {
      entityId: 'ent_era',
      key: 'materialCulture',
      value: 'Bootleg cassettes.',
      provenance: 'inferred',
    })
    const { _provenance, ...bible } = projectEraBible(db, 'ent_era')
    EraBibleSchema.parse(bible)
    expect(bible.identity.label).toContain('Perestroika')
    expect(bible.materialCulture).toContain('Bootleg')
    expect(_provenance['materialCulture']).toBe('inferred')
  })

  it('projectPropBible: happy path', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_prop', type: 'prop', name: 'leather jacket' })
    writeAttribute(db, {
      entityId: 'ent_prop',
      key: 'function.purposeInStory',
      value: 'Alley scenes.',
      provenance: 'canon',
    })
    writeAttribute(db, {
      entityId: 'ent_prop',
      key: 'visuals.continuityNotes',
      value: 'Scuffed elbow.',
      provenance: 'derived',
    })
    writeAttribute(db, {
      entityId: 'ent_prop',
      key: 'visuals.keywords',
      value: ['leather', 'zipper'],
      provenance: 'canon',
    })
    const { _provenance, ...bible } = projectPropBible(db, 'ent_prop')
    PropBibleSchema.parse(bible)
    expect(bible.identity.label).toBe('leather jacket')
    expect(_provenance['visuals.continuityNotes']).toBe('derived')
  })

  it('projectBibleView returns empty bible without parsing required sections', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_empty', type: 'character', name: 'Empty' })
    writeAttribute(db, {
      entityId: 'ent_empty',
      key: 'description',
      value: 'Only a bank description.',
      provenance: 'canon',
      confidence: 1,
      sourceStage: 'lift',
    })
    const view = projectBibleView(db, 'ent_empty')
    expect(view.entityType).toBe('character')
    expect(view.bible).toEqual({})
    expect(view.provenance).toEqual({})
    expect(() => CharacterBibleSchema.parse(view.bible)).toThrow()
  })

  it('projectBible dispatches environment to Character Bible', () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_env', type: 'environment', name: 'Alley' })
    const minimal = {
      demographics: { gender: 'unknown', ageRange: 'n/a', eraLabel: 'Night', housingNotes: 'Rain.' },
      physical: {
        height: 'n/a',
        build: 'n/a',
        face: 'n/a',
        eyes: 'n/a',
        nose: 'n/a',
        lips: 'n/a',
        skin: 'n/a',
      },
      visuals: { portraitBrief: 'wide alley', continuityKeywords: [] },
    }
    seedFixtureAttributes(db, 'ent_env', minimal)
    const out = projectBible(db, 'ent_env')
    expect(out).toHaveProperty('demographics')
    expect(out).toHaveProperty('_provenance')
    const { _provenance, ...bible } = out
    CharacterBibleSchema.parse(bible)
    expect(_provenance).toBeTruthy()
  })
})
