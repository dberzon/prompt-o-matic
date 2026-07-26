import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity } from '../../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../../db/sqlite.js'
import { applyS2Parser } from './s2Parser.js'
import { applyS3Parser } from './s3Parser.js'
import { applyS4Parser } from './s4Parser.js'
import { applyS5Parser } from './s5Parser.js'
import { applyS6Parser } from './s6Parser.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-parsers-test-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

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

describe('applyS2Parser', () => {
  it('accepts valid attributes with empty dropped', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e2', type: 'character', name: 'X' })
    const out = applyS2Parser(db, 'e2', {
      attributes: [{ key: 'wardrobe.jacket', value: 'coat', confidence: 0.5 }],
    })
    expect(out.accepted).toHaveLength(1)
    expect(out.dropped).toHaveLength(0)
  })

  it('records dropped rows for missing key', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e2b', type: 'character', name: 'Y' })
    const out = applyS2Parser(db, 'e2b', {
      attributes: [{ value: 'no-key' }],
    })
    expect(out.accepted).toHaveLength(0)
    expect(out.dropped).toEqual([
      expect.objectContaining({ key: null, reason: 'missing_attribute_key' }),
    ])
  })
})

describe('applyS3Parser', () => {
  it('accepts allowed prefixes with empty dropped', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e3', type: 'character', name: 'Z' })
    const out = applyS3Parser(db, 'e3', {
      attributes: [{ key: 'behavior.temperament', value: 'wry', confidence: 0.7 }],
    })
    expect(out.accepted).toHaveLength(1)
    expect(out.dropped).toHaveLength(0)
  })

  it('drops disallowed key prefixes with reason', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e3b', type: 'character', name: 'W' })
    const out = applyS3Parser(db, 'e3b', {
      attributes: [{ key: 'wardrobe.jacket', value: 'coat' }],
    })
    expect(out.accepted).toHaveLength(0)
    expect(out.dropped[0]).toMatchObject({
      key: 'wardrobe.jacket',
      reason: 'psychology_key_prefix_not_allowed',
    })
  })
})

describe('applyS4Parser', () => {
  it('happy path leaves dropped empty for valid rows', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e4', type: 'character', name: 'Ruslan' })
    const out = applyS4Parser(db, 'e4', {
      environments: [{ name: 'Beer hall', summary: 'Friday' }],
      attributes: [{ key: 'routine.friday', value: 'hangout' }],
      relationshipAttributes: [{
        type: 'friend',
        otherSlug: 'rita',
        value: 'knows Rita',
      }],
    })
    expect(out.dropped).toHaveLength(0)
    expect(out.accepted.length).toBeGreaterThan(0)
    expect(out.suggestions).toHaveLength(1)
  })

  it('drops environments without name and incomplete relationship rows', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e4b', type: 'character', name: 'A' })
    const out = applyS4Parser(db, 'e4b', {
      environments: [{ summary: 'no name' }],
      relationshipAttributes: [{ type: 'x', otherSlug: 'y' }],
    })
    expect(out.suggestions).toHaveLength(0)
    expect(out.dropped.map((d) => d.reason)).toEqual(
      expect.arrayContaining(['environment_missing_name', 'relationship_attribute_incomplete']),
    )
  })

  it('get-or-creates environments so re-runs and duplicate slugs do not crash', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e4c', type: 'character', name: 'Ruslan' })

    const first = applyS4Parser(db, 'e4c', {
      environments: [{ name: 'Beer hall', summary: 'Friday hangout' }],
    })
    expect(first.suggestions).toHaveLength(1)
    expect(first.suggestions[0].id).toBe('env_beer_hall_e4c')

    // Re-run with the same environment name must reuse the row, not UNIQUE-crash.
    const rerun = applyS4Parser(db, 'e4c', {
      environments: [{ name: 'Beer hall', summary: 'Saturday hangout' }],
    })
    expect(rerun.suggestions).toHaveLength(1)
    expect(rerun.suggestions[0].id).toBe('env_beer_hall_e4c')
    expect(rerun.accepted.some((row) => row.key === 'summary' && row.value === 'Saturday hangout')).toBe(true)

    // Case/spacing variants that slugify identically must share one entity in a single payload.
    const dupes = applyS4Parser(db, 'e4c', {
      environments: [
        { name: 'Kitchen', summary: 'morning' },
        { name: 'kitchen', summary: 'evening' },
      ],
    })
    expect(dupes.suggestions).toHaveLength(1)
    expect(dupes.suggestions[0].id).toBe('env_kitchen_e4c')
    expect(dupes.accepted.filter((row) => row.entityId === 'env_kitchen_e4c')).toHaveLength(2)
  })
})

describe('applyS5Parser', () => {
  it('writes descriptor with empty dropped', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e5', type: 'character', name: 'B' })
    const out = applyS5Parser(db, 'e5', { visualDescriptor: 'x'.repeat(25) })
    expect(out.accepted).toHaveLength(1)
    expect(out.dropped).toHaveLength(0)
  })

  it('drops when descriptor missing', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e5b', type: 'character', name: 'C' })
    const out = applyS5Parser(db, 'e5b', {})
    expect(out.accepted).toHaveLength(0)
    expect(out.dropped[0]).toMatchObject({
      key: 'visual.descriptor',
      reason: 'missing_visual_descriptor',
    })
  })
})

describe('applyS6Parser', () => {
  it('writes conflict rows and empty dropped for valid conflicts', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e6', type: 'character', name: 'D' })
    const out = applyS6Parser(db, 'e6', {
      conflicts: [{ key: 'eyes', message: 'mismatch', attributeIds: ['a', 'b'] }],
    })
    expect(out.accepted).toHaveLength(1)
    expect(out.dropped).toHaveLength(0)
    expect(out.conflicts).toHaveLength(1)
  })

  it('drops conflicts without message', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'e6b', type: 'character', name: 'E' })
    const out = applyS6Parser(db, 'e6b', {
      conflicts: [{ key: 'hair' }],
    })
    expect(out.accepted).toHaveLength(0)
    expect(out.dropped[0]).toMatchObject({
      key: 'hair',
      reason: 'conflict_missing_message',
    })
  })
})
