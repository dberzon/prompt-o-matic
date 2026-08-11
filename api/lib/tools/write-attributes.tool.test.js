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

  it('supersedes existing same-or-weaker active heads instead of stacking dual canon', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_tool_2', type: 'character', name: 'Test' })
    setWriteAttributesDb({ db })
    const reg = createRegistry({ tools: [writeAttributesTool] })

    await reg.invoke('write-attributes', {
      entityId: entity.id,
      attributes: [{ key: 'eyes', value: 'green', provenance: 'canon' }],
    })
    const out = await reg.invoke('write-attributes', {
      entityId: entity.id,
      attributes: [{ key: 'eyes', value: 'blue', provenance: 'canon' }],
    })

    expect(out.written).toHaveLength(1)
    expect(out.written[0]).toMatchObject({ key: 'eyes', value: 'blue', provenance: 'canon' })

    const { listAttributes } = await import('../db/repositories.js')
    const active = listAttributes(db, { entityId: entity.id, key: 'eyes' })
    expect(active).toHaveLength(1)
    expect(active[0].value).toBe('blue')

    const all = listAttributes(db, {
      entityId: entity.id,
      key: 'eyes',
      includeSuperseded: true,
    })
    expect(all).toHaveLength(2)
    const superseded = all.find((a) => a.value === 'green')
    expect(superseded?.supersededBy).toBe(active[0].id)
  })

  it('does not supersede stronger canon when writing weaker inferred', async () => {
    const { db } = createTempDb()
    const entity = createEntity(db, { id: 'ent_tool_3', type: 'character', name: 'Test' })
    setWriteAttributesDb({ db })
    const reg = createRegistry({ tools: [writeAttributesTool] })

    await reg.invoke('write-attributes', {
      entityId: entity.id,
      attributes: [{ key: 'eyes', value: 'green', provenance: 'canon' }],
    })
    await reg.invoke('write-attributes', {
      entityId: entity.id,
      attributes: [{ key: 'eyes', value: 'hazel', provenance: 'inferred' }],
    })

    const { listAttributes } = await import('../db/repositories.js')
    const active = listAttributes(db, { entityId: entity.id, key: 'eyes' })
    expect(active).toHaveLength(2)
    expect(active.map((a) => a.provenance).sort()).toEqual(['canon', 'inferred'])
  })
})
