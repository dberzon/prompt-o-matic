import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntity, listAttributes } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import {
  approveBibleSection,
  BIBLE_SECTION_PENDING_TS,
  getBibleApprovals,
  rejectBibleSection,
} from './approval.js'
import { EntityNotFoundError } from './projection.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bible-approval-'))
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

describe('bible section approval', () => {
  it('approveBibleSection writes _approval.<section> via writeAttribute (canon row)', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_c', type: 'character', name: 'C' })
    const { ok, attributeId } = approveBibleSection(db, 'ent_c', 'demographics', { actor: 'alice' })
    expect(ok).toBe(true)
    expect(attributeId).toBeTruthy()
    const rows = listAttributes(db, { entityId: 'ent_c', key: '_approval.demographics' })
    expect(rows).toHaveLength(1)
    expect(rows[0].provenance).toBe('canon')
    expect(rows[0].value).toMatchObject({ state: 'approved', actor: 'alice' })
    expect(typeof rows[0].value.ts).toBe('string')
  })

  it('re-approving an already-approved section is idempotent (no second attribute row)', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_c', type: 'character', name: 'C' })
    const first = approveBibleSection(db, 'ent_c', 'demographics', { actor: 'alice' })
    const second = approveBibleSection(db, 'ent_c', 'demographics', { actor: 'bob' })
    expect(second.attributeId).toBe(first.attributeId)
    const rows = listAttributes(db, { entityId: 'ent_c', key: '_approval.demographics' })
    expect(rows).toHaveLength(1)
  })

  it('rejectBibleSection writes rejected head', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_c', type: 'character', name: 'C' })
    const r = rejectBibleSection(db, 'ent_c', 'visuals', { actor: 'reviewer', note: ' blurry ' })
    expect(r.ok).toBe(true)
    const approvals = getBibleApprovals(db, 'ent_c')
    expect(approvals.visuals.state).toBe('rejected')
    expect(approvals.visuals.actor).toBe('reviewer')
    expect(approvals.visuals.ts).toMatch(/^\d{4}-/)
  })

  it('unknown section throws', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_c', type: 'character', name: 'C' })
    expect(() => approveBibleSection(db, 'ent_c', 'not_a_section', { actor: 'a' })).toThrow(
      /unknown Bible section/,
    )
    expect(() => rejectBibleSection(db, 'ent_c', 'not_a_section', { actor: 'a' })).toThrow(/unknown Bible section/)
  })

  it('getBibleApprovals returns pending for sections never approved', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_loc', type: 'location', name: 'L' })
    const approvals = getBibleApprovals(db, 'ent_loc')
    for (const v of Object.values(approvals)) {
      expect(v.state).toBe('pending')
      expect(v.ts).toBe(BIBLE_SECTION_PENDING_TS)
      expect(v.actor).toBeUndefined()
    }
    expect(approvals.identity.state).toBe('pending')
  })

  it('getBibleApprovals reflects latest approve after reject', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_c', type: 'character', name: 'C' })
    rejectBibleSection(db, 'ent_c', 'physical', { actor: 'r1' })
    expect(getBibleApprovals(db, 'ent_c').physical.state).toBe('rejected')
    approveBibleSection(db, 'ent_c', 'physical', { actor: 'r2' })
    db.prepare('UPDATE entity_attributes SET created_at = ? WHERE entity_id = ? AND key = ?').run(
      '2026-01-01T00:00:00.000Z',
      'ent_c',
      '_approval.physical',
    )
    const a = getBibleApprovals(db, 'ent_c').physical
    expect(a.state).toBe('approved')
    expect(a.actor).toBe('r2')
  })

  it('missing entity throws EntityNotFoundError', () => {
    const db = ensureDb(createTempDbPath())
    expect(() => approveBibleSection(db, 'missing', 'demographics', { actor: 'a' })).toThrow(EntityNotFoundError)
    expect(() => getBibleApprovals(db, 'missing')).toThrow(EntityNotFoundError)
  })

  it('rejects demographics as section for location entity', () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: 'ent_loc', type: 'location', name: 'L' })
    expect(() => approveBibleSection(db, 'ent_loc', 'demographics', { actor: 'a' })).toThrow(/unknown Bible section/)
  })
})
