import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../sqlite.js'
import { FILE_MIGRATIONS, FILE_MIGRATION_STATEMENTS } from './index.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-migrations-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  return { db, dbPath }
}

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name)
}

function indexNames(db, table) {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?`).all(table).map((r) => r.name)
}

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('migrations registry (api/lib/db/migrations/index.js)', () => {
  it('FILE_MIGRATIONS includes 2026-05-add-projects with non-empty sql', () => {
    const mig = FILE_MIGRATIONS.find((m) => m.id === '2026-05-add-projects')
    expect(mig).toBeTruthy()
    expect(mig.sql.length).toBeGreaterThan(0)
    expect(mig.sql).toMatch(/CREATE TABLE IF NOT EXISTS projects/i)
  })

  it('FILE_MIGRATIONS includes 2026-05-bible-snapshots after projects', () => {
    const ids = FILE_MIGRATIONS.map((m) => m.id)
    const projIdx = ids.indexOf('2026-05-add-projects')
    const bibleIdx = ids.indexOf('2026-05-bible-snapshots')
    expect(bibleIdx).toBeGreaterThan(-1)
    expect(projIdx).toBeGreaterThan(-1)
    expect(bibleIdx).toBeGreaterThan(projIdx)
    const mig = FILE_MIGRATIONS.find((m) => m.id === '2026-05-bible-snapshots')
    expect(mig.sql).toMatch(/CREATE TABLE IF NOT EXISTS bible_snapshots/i)
  })

  it('FILE_MIGRATIONS includes 2026-05-character-bank-project after bible-snapshots', () => {
    const ids = FILE_MIGRATIONS.map((m) => m.id)
    const bibleIdx = ids.indexOf('2026-05-bible-snapshots')
    const bankIdx = ids.indexOf('2026-05-character-bank-project')
    expect(bankIdx).toBeGreaterThan(-1)
    expect(bibleIdx).toBeGreaterThan(-1)
    expect(bankIdx).toBeGreaterThan(bibleIdx)
    const mig = FILE_MIGRATIONS.find((m) => m.id === '2026-05-character-bank-project')
    expect(mig.sql).toMatch(/character_bank_entries/i)
  })

  it('FILE_MIGRATION_STATEMENTS is a non-empty ordered list of statements', () => {
    expect(Array.isArray(FILE_MIGRATION_STATEMENTS)).toBe(true)
    expect(FILE_MIGRATION_STATEMENTS.length).toBeGreaterThan(0)
    for (const stmt of FILE_MIGRATION_STATEMENTS) {
      expect(typeof stmt).toBe('string')
      expect(stmt.trim().length).toBeGreaterThan(0)
    }
  })

  it('FILE_MIGRATION_STATEMENTS strips line comments', () => {
    for (const stmt of FILE_MIGRATION_STATEMENTS) {
      expect(stmt.startsWith('--')).toBe(false)
    }
  })
})

describe('2026-05-add-projects migration: schema & seed', () => {
  it('creates the projects table after initializeDatabase', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(tableNames(db)).toContain('projects')
    db.close()
  })

  it('projects table has the expected columns', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const cols = columnNames(db, 'projects').sort()
    expect(cols).toEqual([
      'active',
      'created_at',
      'era_entity_id',
      'id',
      'name',
      'payload_json',
      'slug',
      'updated_at',
    ])
    db.close()
  })

  it('character_bank_entries gains project_id after initializeDatabase', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(columnNames(db, 'character_bank_entries')).toContain('project_id')
    db.close()
  })

  it('entities table gains a project_id column', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(columnNames(db, 'entities')).toContain('project_id')
    db.close()
  })

  it('creates idx_entities_project_id index', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(indexNames(db, 'entities')).toContain('idx_entities_project_id')
    db.close()
  })

  it('seeds exactly one default project row (slug=default, id=proj_default)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const row = db.prepare("SELECT id, slug, name, active FROM projects WHERE slug = 'default'").get()
    expect(row).toBeTruthy()
    expect(row.id).toBe('proj_default')
    expect(row.slug).toBe('default')
    expect(row.name).toBe('Default Project')
    expect(row.active).toBe(1)
    const count = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE slug = 'default'").get().n
    expect(count).toBe(1)
    db.close()
  })

  it('projects.slug is UNIQUE (second insert rejected)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const now = new Date().toISOString()
    expect(() =>
      db.prepare(
        `INSERT INTO projects (id, slug, name, active, created_at, updated_at)
         VALUES ('proj_dup', 'default', 'Duplicate', 1, ?, ?)`,
      ).run(now, now),
    ).toThrow(/UNIQUE/i)
    db.close()
  })
})

describe('2026-05-add-projects migration: backfill', () => {
  it('does not rewrite NULL project_id on a second initializeDatabase (one-time legacy backfill)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO entities (id, type, name, created_at, updated_at, project_id) VALUES ('e_pre', 'character', 'Elena', ?, ?, NULL)",
    ).run(now, now)
    expect(db.prepare("SELECT project_id FROM entities WHERE id = 'e_pre'").get().project_id).toBeNull()

    initializeDatabase(db)
    expect(db.prepare("SELECT project_id FROM entities WHERE id = 'e_pre'").get().project_id).toBeNull()
    db.close()
  })

  it('does not rewrite NULL project_id on characters / prompt_packs / generated_images after marker exists', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO characters (id, project_id, embedding_status, payload_json, created_at, updated_at)
       VALUES ('char_pre', NULL, 'not_indexed', '{}', ?, ?)`,
    ).run(now, now)
    db.prepare(
      `INSERT INTO prompt_packs (id, character_id, project_id, payload_json, created_at, updated_at)
       VALUES ('pack_pre', 'char_pre', NULL, '{}', ?, ?)`,
    ).run(now, now)
    db.prepare(
      `INSERT INTO generated_images (id, prompt_pack_id, project_id, payload_json, created_at, updated_at)
       VALUES ('img_pre', 'pack_pre', NULL, '{}', ?, ?)`,
    ).run(now, now)

    initializeDatabase(db)

    expect(db.prepare("SELECT project_id FROM characters WHERE id = 'char_pre'").get().project_id).toBeNull()
    expect(db.prepare("SELECT project_id FROM prompt_packs WHERE id = 'pack_pre'").get().project_id).toBeNull()
    expect(db.prepare("SELECT project_id FROM generated_images WHERE id = 'img_pre'").get().project_id).toBeNull()
    db.close()
  })
})

describe('2026-05-add-projects migration: idempotency', () => {
  it('re-applying the migration is a no-op (no duplicates, no errors)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const firstCount = db.prepare("SELECT COUNT(*) AS n FROM projects").get().n
    const firstDefault = db.prepare("SELECT * FROM projects WHERE id = 'proj_default'").get()

    initializeDatabase(db)
    initializeDatabase(db)

    const finalCount = db.prepare("SELECT COUNT(*) AS n FROM projects").get().n
    const finalDefault = db.prepare("SELECT * FROM projects WHERE id = 'proj_default'").get()
    expect(finalCount).toBe(firstCount)
    expect(finalDefault).toEqual(firstDefault)
    db.close()
  })

  it('re-applying does not add a second project_id column to entities', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    initializeDatabase(db)
    const projectIdCols = columnNames(db, 'entities').filter((c) => c === 'project_id')
    expect(projectIdCols.length).toBe(1)
    db.close()
  })

  it('re-applying does not duplicate idx_entities_project_id', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    initializeDatabase(db)
    const idx = indexNames(db, 'entities').filter((n) => n === 'idx_entities_project_id')
    expect(idx.length).toBe(1)
    db.close()
  })

  it('persists across reopen and remains a no-op on third initialize', () => {
    const { db, dbPath } = createTempDb()
    initializeDatabase(db)
    db.close()

    // Reopen the same on-disk DB and verify default project is still there.
    const db2 = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
    initializeDatabase(db2)
    const row = db2.prepare("SELECT id, slug FROM projects WHERE id = 'proj_default'").get()
    expect(row).toEqual({ id: 'proj_default', slug: 'default' })
    const count = db2.prepare("SELECT COUNT(*) AS n FROM projects").get().n
    expect(count).toBe(1)
    db2.close()
  })
})

describe('2026-05-bible-snapshots migration: schema', () => {
  it('creates bible_snapshots after initializeDatabase', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(tableNames(db)).toContain('bible_snapshots')
    db.close()
  })

  it('bible_snapshots has expected columns', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const cols = columnNames(db, 'bible_snapshots').sort()
    expect(cols).toEqual([
      'bible_json',
      'created_at',
      'entity_id',
      'id',
      'label',
      'parent_snapshot_id',
      'project_id',
    ])
    db.close()
  })

  it('creates idx_bible_snapshots_entity and idx_bible_snapshots_project', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(indexNames(db, 'bible_snapshots')).toContain('idx_bible_snapshots_entity')
    expect(indexNames(db, 'bible_snapshots')).toContain('idx_bible_snapshots_project')
    db.close()
  })
})

describe('2026-05-bible-snapshots migration: idempotency & round-trip', () => {
  it('apply → round-trip row → apply again is a no-op (no errors, stable counts)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO entities (id, type, name, created_at, updated_at, project_id) VALUES ('e_bible_rt', 'character', 'X', ?, ?, 'proj_default')",
    ).run(now, now)

    db.prepare(
      `INSERT INTO bible_snapshots (id, entity_id, project_id, label, bible_json, parent_snapshot_id, created_at)
       VALUES ('snap_rt', 'e_bible_rt', 'proj_default', 'rt', ?, NULL, ?)`,
    ).run(JSON.stringify({ ok: true }), now)

    const first = db.prepare("SELECT * FROM bible_snapshots WHERE id = 'snap_rt'").get()
    expect(JSON.parse(first.bible_json)).toEqual({ ok: true })

    initializeDatabase(db)
    initializeDatabase(db)

    const second = db.prepare("SELECT * FROM bible_snapshots WHERE id = 'snap_rt'").get()
    expect(second).toEqual(first)
    const n = db.prepare('SELECT COUNT(*) AS c FROM bible_snapshots').get().c
    expect(n).toBe(1)
    db.close()
  })
})

describe('2026-05-add-projects migration: round-trip', () => {
  it('write and read a canonical project row', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    const now = '2026-05-13T12:00:00.000Z'
    db.prepare(
      `INSERT INTO projects (id, slug, name, era_entity_id, active, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'proj_rt',
      'round-trip',
      'Round Trip',
      'era_001',
      1,
      JSON.stringify({ description: 'noir 1947' }),
      now,
      now,
    )
    const row = db.prepare("SELECT * FROM projects WHERE id = 'proj_rt'").get()
    expect(row.id).toBe('proj_rt')
    expect(row.slug).toBe('round-trip')
    expect(row.name).toBe('Round Trip')
    expect(row.era_entity_id).toBe('era_001')
    expect(row.active).toBe(1)
    expect(JSON.parse(row.payload_json)).toEqual({ description: 'noir 1947' })
    expect(row.created_at).toBe(now)
    expect(row.updated_at).toBe(now)
    db.close()
  })
})
