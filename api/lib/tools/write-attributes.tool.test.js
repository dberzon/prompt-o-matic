import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createRegistry } from './registrar.js'
import writeAttributesTool, { clearWriteAttributesDb, setWriteAttributesDb } from './write-attributes.tool.js'

const tempDirs = []
/** @type {import('better-sqlite3').Database | null} */
let activeDb = null

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-write-attr-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  activeDb = db
  return { db, dbPath }
}

afterEach(() => {
  clearWriteAttributesDb()
  if (activeDb) {
    try {
      activeDb.close()
    } catch {
      // ignore
    }
    activeDb = null
  }
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('write-attributes tool', () => {
  it('writes valid rows, dedupes identical active attributes, and rejects invalid schema / keys', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_tool_1', type: 'character', name: 'Test' })
    setWriteAttributesDb({ db })

    const reg = createRegistry({ tools: [writeAttributesTool] })

    const out = await reg.invoke('write-attributes', {
      entityId: entity.id,
      attributes: [
        { key: 'demographics.gender', value: 'x', provenance: 'inferred', confidence: 0.9 },
        { key: 'demographics.gender', value: 'x', provenance: 'inferred', confidence: 0.9 },
        { key: 'bogus_root.field', value: 'nope', provenance: 'canon' },
        { key: 'eyes', value: 'green', provenance: 'canon' },
        { key: 'mood', value: 'calm', provenance: 'guess' },
      ],
    })

    expect(out.written).toHaveLength(2)
    expect(out.deduped).toHaveLength(1)
    expect(out.deduped[0]).toMatchObject({ key: 'demographics.gender', provenance: 'inferred' })
    expect(out.rejected).toHaveLength(2)
    expect(out.rejected.map((r) => r.reason)).toContain('invalid_character_key_root:bogus_root')
    expect(out.rejected.some((r) => r.reason === 'schema_invalid')).toBe(true)

    for (const row of out.written) {
      expect(row.provenance).toBeTruthy()
      expect(['canon', 'inferred', 'suggested', 'temporary', 'derived']).toContain(row.provenance)
    }
  })

  it('accepts character-bible keys for environment entities', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_env_tool', type: 'environment', name: 'Alley' })
    setWriteAttributesDb({ db })

    const reg = createRegistry({ tools: [writeAttributesTool] })

    const out = await reg.invoke('write-attributes', {
      entityId: entity.id,
      attributes: [
        { key: 'demographics.gender', value: 'n/a', provenance: 'inferred' },
        { key: 'visuals.portraitBrief', value: 'rain-slick alley', provenance: 'inferred' },
      ],
    })

    expect(out.rejected).toEqual([])
    expect(out.written.map((row) => row.key)).toEqual(['demographics.gender', 'visuals.portraitBrief'])
  })
})
