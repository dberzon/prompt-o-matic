import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createActorAudition,
  createActorCandidate,
  deleteActorAudition,
  deleteActorCandidate,
  getActorAudition,
  getActorCandidate,
  listActorAuditions,
  listActorCandidates,
  updateActorAudition,
  updateActorCandidate,
} from './repositories.js'
import { createSqliteDatabase, initializeDatabase } from './sqlite.js'

const tempDirs = []
let db = null

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-actor-entities-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const instance = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(instance)
  return instance
}

beforeEach(() => {
  db = createTempDb()
})

afterEach(() => {
  db?.close()
  db = null
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeCandidate(overrides = {}) {
  return {
    id: 'actor_001',
    status: 'available',
    createdAt: '2026-04-28T12:00:00.000Z',
    updatedAt: '2026-04-28T12:00:00.000Z',
    ...overrides,
  }
}

function makeAudition(overrides = {}) {
  return {
    id: 'audition_001',
    actorCandidateId: 'actor_001',
    bankEntryId: 'bank_001',
    status: 'pending',
    createdAt: '2026-04-28T12:10:00.000Z',
    updatedAt: '2026-04-28T12:10:00.000Z',
    ...overrides,
  }
}

describe('actor_candidates repository', () => {
  it('create + getActorCandidate round-trip', () => {
    const created = createActorCandidate(db, makeCandidate())
    const fetched = getActorCandidate(db, created.id)
    expect(fetched).toEqual(created)
  })

  it('listActorCandidates returns ordered by createdAt DESC', () => {
    createActorCandidate(db, makeCandidate({ id: 'actor_001', createdAt: '2026-04-28T10:00:00.000Z', updatedAt: '2026-04-28T10:00:00.000Z' }))
    createActorCandidate(db, makeCandidate({ id: 'actor_002', createdAt: '2026-04-28T11:00:00.000Z', updatedAt: '2026-04-28T11:00:00.000Z' }))
    createActorCandidate(db, makeCandidate({ id: 'actor_003', createdAt: '2026-04-28T12:00:00.000Z', updatedAt: '2026-04-28T12:00:00.000Z' }))
    expect(listActorCandidates(db).map((item) => item.id)).toEqual(['actor_003', 'actor_002', 'actor_001'])
  })

  it('listActorCandidates filters by status', () => {
    createActorCandidate(db, makeCandidate({ id: 'actor_a', status: 'available' }))
    createActorCandidate(db, makeCandidate({ id: 'actor_b', status: 'archived', createdAt: '2026-04-28T12:01:00.000Z', updatedAt: '2026-04-28T12:01:00.000Z' }))
    const items = listActorCandidates(db, { status: 'archived' })
    expect(items.map((item) => item.id)).toEqual(['actor_b'])
  })

  it('listActorCandidates filters by sourceBankEntryId and promptPackId', () => {
    createActorCandidate(db, makeCandidate({ id: 'actor_a', sourceBankEntryId: 'bank_1', promptPackId: 'pack_1' }))
    createActorCandidate(db, makeCandidate({ id: 'actor_b', sourceBankEntryId: 'bank_2', promptPackId: 'pack_2', createdAt: '2026-04-28T12:01:00.000Z', updatedAt: '2026-04-28T12:01:00.000Z' }))
    expect(listActorCandidates(db, { sourceBankEntryId: 'bank_2' }).map((item) => item.id)).toEqual(['actor_b'])
    expect(listActorCandidates(db, { promptPackId: 'pack_1' }).map((item) => item.id)).toEqual(['actor_a'])
  })

  it('updateActorCandidate merges patch and bumps updatedAt; returns null for nonexistent id', () => {
    const created = createActorCandidate(db, makeCandidate({ notes: 'Before' }))
    const updated = updateActorCandidate(db, created.id, { status: 'archived', notes: 'After' })
    expect(updated).not.toBeNull()
    expect(updated.status).toBe('archived')
    expect(updated.notes).toBe('After')
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
    expect(updateActorCandidate(db, 'missing_id', { status: 'archived' })).toBeNull()
  })

  it('deleteActorCandidate returns true on first delete, false on second', () => {
    const created = createActorCandidate(db, makeCandidate())
    expect(deleteActorCandidate(db, created.id)).toBe(true)
    expect(deleteActorCandidate(db, created.id)).toBe(false)
  })
})

describe('actor_auditions repository', () => {
  it('create + getActorAudition round-trip', () => {
    const created = createActorAudition(db, makeAudition())
    const fetched = getActorAudition(db, created.id)
    expect(fetched).toEqual(created)
  })

  it('createActorAudition rejects duplicate (actor_candidate_id, bank_entry_id) pair', () => {
    createActorAudition(db, makeAudition({ id: 'aud_1' }))
    try {
      createActorAudition(db, makeAudition({ id: 'aud_2' }))
      throw new Error('Expected unique constraint error')
    } catch (err) {
      expect(err?.code).toBe('SQLITE_CONSTRAINT_UNIQUE')
    }
  })

  it('allows same actorCandidateId paired with different bankEntryId', () => {
    createActorAudition(db, makeAudition({ id: 'aud_1', actorCandidateId: 'actor_same', bankEntryId: 'bank_1' }))
    createActorAudition(db, makeAudition({
      id: 'aud_2',
      actorCandidateId: 'actor_same',
      bankEntryId: 'bank_2',
      createdAt: '2026-04-28T12:11:00.000Z',
      updatedAt: '2026-04-28T12:11:00.000Z',
    }))
    const items = listActorAuditions(db, { actorCandidateId: 'actor_same' })
    expect(items.map((item) => item.id)).toEqual(['aud_2', 'aud_1'])
  })

  it('listActorAuditions filters by actorCandidateId, bankEntryId, status', () => {
    createActorAudition(db, makeAudition({ id: 'aud_1', actorCandidateId: 'actor_1', bankEntryId: 'bank_1', status: 'pending' }))
    createActorAudition(db, makeAudition({
      id: 'aud_2',
      actorCandidateId: 'actor_2',
      bankEntryId: 'bank_2',
      status: 'approved',
      createdAt: '2026-04-28T12:11:00.000Z',
      updatedAt: '2026-04-28T12:11:00.000Z',
    }))
    expect(listActorAuditions(db, { actorCandidateId: 'actor_2' }).map((item) => item.id)).toEqual(['aud_2'])
    expect(listActorAuditions(db, { bankEntryId: 'bank_1' }).map((item) => item.id)).toEqual(['aud_1'])
    expect(listActorAuditions(db, { status: 'approved' }).map((item) => item.id)).toEqual(['aud_2'])
  })

  it('updateActorAudition transitions pending to approved with notes and bumps updatedAt', () => {
    const created = createActorAudition(db, makeAudition({ status: 'pending' }))
    const updated = updateActorAudition(db, created.id, { status: 'approved', notes: 'Approved after review' })
    expect(updated).not.toBeNull()
    expect(updated.status).toBe('approved')
    expect(updated.notes).toBe('Approved after review')
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
  })

  it('deleteActorAudition returns true on first delete, false on second', () => {
    const created = createActorAudition(db, makeAudition())
    expect(deleteActorAudition(db, created.id)).toBe(true)
    expect(deleteActorAudition(db, created.id)).toBe(false)
  })
})
