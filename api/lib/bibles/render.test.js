import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { projectCharacterBible } from './projection.js'
import { renderBibleMarkdown, renderBiblePdf, stripProvenance } from './render.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bible-render-'))
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

describe('stripProvenance', () => {
  it('drops _provenance', () => {
    expect(stripProvenance({ a: 1, _provenance: { x: 'canon' } })).toEqual({ a: 1 })
  })
})

describe('renderBibleMarkdown', () => {
  it('matches snapshot for minimal projected character bible', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_md', type: 'character', name: 'MD' })
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
    seedFixtureAttributes(db, 'ent_md', minimal)
    const bible = projectCharacterBible(db, 'ent_md')
    const md = renderBibleMarkdown(bible)
    await expect(md).toMatchSnapshot()
  })

  it('uses blockquote for empty required string and italic for optional empty', () => {
    const md = renderBibleMarkdown({
      demographics: {
        gender: 'f',
        ageRange: '30s',
        eraLabel: 'Now',
        housingNotes: '',
      },
      physical: {
        height: 'tall',
        build: 'slim',
        face: 'oval',
        eyes: 'green',
        nose: 'straight',
        lips: 'full',
        skin: 'tan',
      },
      visuals: { portraitBrief: '', continuityKeywords: ['x'] },
    })
    expect(md).toContain('> **Missing required field**')
    expect(md).toContain('_(not yet specified)_')
  })
})

describe('renderBiblePdf', () => {
  it('returns a non-empty PDF buffer', async () => {
    const buf = await renderBiblePdf('## Test\n\nHello world.\n')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(100)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
