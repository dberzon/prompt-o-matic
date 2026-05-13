import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../sqlite.js'
import { createBibleSnapshot, getBibleSnapshot, listBibleSnapshots } from './bibleSnapshots.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bible-snapshots-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  return { db, dbPath }
}

function seedEntityAndProject(db) {
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO entities (id, type, name, created_at, updated_at, project_id) VALUES ('ent_bs', 'character', 'Hero', ?, ?, 'proj_default')",
  ).run(now, now)
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('bibleSnapshots repository', () => {
  it('createBibleSnapshot stores bible_json as string and returns parsed bibleJson', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    seedEntityAndProject(db)
    const payload = { version: 1, sections: ['a'] }
    const rec = createBibleSnapshot(db, {
      entityId: 'ent_bs',
      projectId: 'proj_default',
      label: 'approved',
      bibleJson: JSON.stringify(payload),
    })
    expect(rec).toBeTruthy()
    expect(rec.bibleJson).toEqual(payload)
    const raw = db.prepare('SELECT bible_json FROM bible_snapshots WHERE id = ?').get(rec.id)
    expect(typeof raw.bible_json).toBe('string')
    expect(raw.bible_json).toBe(JSON.stringify(payload))
    db.close()
  })

  it('createBibleSnapshot accepts object bibleJson (serializes internally)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    seedEntityAndProject(db)
    const payload = { foo: 'bar' }
    const rec = createBibleSnapshot(db, {
      entityId: 'ent_bs',
      label: 'draft',
      bibleJson: payload,
    })
    expect(rec.bibleJson).toEqual(payload)
    db.close()
  })

  it('getBibleSnapshot returns null for missing id', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(getBibleSnapshot(db, 'nope')).toBeNull()
    db.close()
  })

  it('listBibleSnapshots returns newest-first by created_at', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    seedEntityAndProject(db)
    const a = createBibleSnapshot(db, { entityId: 'ent_bs', label: 'a', bibleJson: { n: 1 } })
    const b = createBibleSnapshot(db, { entityId: 'ent_bs', label: 'b', bibleJson: { n: 2 } })
    db.prepare('UPDATE bible_snapshots SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', a.id)
    db.prepare('UPDATE bible_snapshots SET created_at = ? WHERE id = ?').run('2026-06-01T00:00:00.000Z', b.id)
    const list = listBibleSnapshots(db, { entityId: 'ent_bs' })
    expect(list.map((r) => r.id)).toEqual([b.id, a.id])
    db.close()
  })

  it('listBibleSnapshots filters by entityId, projectId, and label', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    seedEntityAndProject(db)
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO entities (id, type, name, created_at, updated_at, project_id) VALUES ('ent_other', 'character', 'Other', ?, ?, 'proj_default')",
    ).run(now, now)
    createBibleSnapshot(db, { entityId: 'ent_bs', projectId: 'proj_default', label: 'L1', bibleJson: {} })
    createBibleSnapshot(db, { entityId: 'ent_bs', projectId: null, label: 'L2', bibleJson: {} })
    createBibleSnapshot(db, { entityId: 'ent_other', label: 'L1', bibleJson: {} })

    expect(listBibleSnapshots(db, { entityId: 'ent_bs' }).length).toBe(2)
    expect(listBibleSnapshots(db, { entityId: 'ent_bs', label: 'L1' }).length).toBe(1)
    expect(listBibleSnapshots(db, { entityId: 'ent_bs', projectId: 'proj_default' }).length).toBe(1)
    db.close()
  })

  it('rejects snapshot when entity_id does not exist (FK)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    expect(() =>
      createBibleSnapshot(db, {
        entityId: 'missing_entity',
        label: 'x',
        bibleJson: {},
      }),
    ).toThrow(/FOREIGN KEY/i)
    db.close()
  })

  it('rejects snapshot when project_id is invalid (FK)', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    seedEntityAndProject(db)
    expect(() =>
      createBibleSnapshot(db, {
        entityId: 'ent_bs',
        projectId: 'no_such_project',
        label: 'x',
        bibleJson: {},
      }),
    ).toThrow(/FOREIGN KEY/i)
    db.close()
  })

  it('allows parent_snapshot_id chain when parent exists', () => {
    const { db } = createTempDb()
    initializeDatabase(db)
    seedEntityAndProject(db)
    const first = createBibleSnapshot(db, { entityId: 'ent_bs', label: 'v1', bibleJson: { v: 1 } })
    const second = createBibleSnapshot(db, {
      entityId: 'ent_bs',
      label: 'v2',
      bibleJson: { v: 2 },
      parentSnapshotId: first.id,
    })
    expect(second.parentSnapshotId).toBe(first.id)
    db.close()
  })
})
