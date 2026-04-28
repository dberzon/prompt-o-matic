import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createBankEntry,
  deleteBankEntry,
  getBankEntry,
  getBankEntryBySlug,
  listBankEntries,
  updateBankEntry,
} from './repositories.js'
import { createSqliteDatabase, initializeDatabase } from './sqlite.js'

const tempDirs = []
let db = null

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-bank-test-'))
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

function makeEntry(overrides = {}) {
  return {
    id: 'bank_001',
    slug: 'lena_sholk',
    name: 'Lena Sholk',
    description: 'A precise and grounded lead.',
    optimizedDescription: 'Optimized concise text.',
    createdAt: '2026-04-28T12:00:00.000Z',
    updatedAt: '2026-04-28T12:00:00.000Z',
    ...overrides,
  }
}

describe('character_bank_entries repository', () => {
  it('create + getBankEntry round-trip', () => {
    const created = createBankEntry(db, makeEntry())
    const fetched = getBankEntry(db, created.id)
    expect(fetched).toEqual(created)
  })

  it('create + getBankEntryBySlug returns the same record', () => {
    const created = createBankEntry(db, makeEntry())
    const fetched = getBankEntryBySlug(db, created.slug)
    expect(fetched).toEqual(created)
  })

  it('createBankEntry rejects duplicate slug', () => {
    createBankEntry(db, makeEntry({ id: 'bank_001' }))
    try {
      createBankEntry(db, makeEntry({ id: 'bank_002' }))
      throw new Error('Expected unique constraint error')
    } catch (err) {
      expect(err?.code).toBe('SQLITE_CONSTRAINT_UNIQUE')
    }
  })

  it('listBankEntries returns entries ordered by createdAt DESC', () => {
    createBankEntry(db, makeEntry({ id: 'bank_001', slug: 'alpha_one', createdAt: '2026-04-28T10:00:00.000Z', updatedAt: '2026-04-28T10:00:00.000Z' }))
    createBankEntry(db, makeEntry({ id: 'bank_002', slug: 'beta_two', createdAt: '2026-04-28T11:00:00.000Z', updatedAt: '2026-04-28T11:00:00.000Z' }))
    createBankEntry(db, makeEntry({ id: 'bank_003', slug: 'gamma_three', createdAt: '2026-04-28T12:00:00.000Z', updatedAt: '2026-04-28T12:00:00.000Z' }))
    expect(listBankEntries(db).map((entry) => entry.id)).toEqual(['bank_003', 'bank_002', 'bank_001'])
  })

  it('listBankEntries respects limit filter', () => {
    createBankEntry(db, makeEntry({ id: 'bank_001', slug: 'alpha_one' }))
    createBankEntry(db, makeEntry({ id: 'bank_002', slug: 'beta_two', createdAt: '2026-04-28T12:01:00.000Z', updatedAt: '2026-04-28T12:01:00.000Z' }))
    createBankEntry(db, makeEntry({ id: 'bank_003', slug: 'gamma_three', createdAt: '2026-04-28T12:02:00.000Z', updatedAt: '2026-04-28T12:02:00.000Z' }))
    const items = listBankEntries(db, { limit: 2 })
    expect(items).toHaveLength(2)
    expect(items.map((entry) => entry.id)).toEqual(['bank_003', 'bank_002'])
  })

  it('updateBankEntry merges patch fields and bumps updatedAt', () => {
    const created = createBankEntry(db, makeEntry())
    const updated = updateBankEntry(db, created.id, {
      name: 'Lena Prime',
      optimizedDescription: 'Refined',
    })
    expect(updated).not.toBeNull()
    expect(updated.name).toBe('Lena Prime')
    expect(updated.optimizedDescription).toBe('Refined')
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
  })

  it('updateBankEntry returns null for nonexistent id', () => {
    const updated = updateBankEntry(db, 'missing_id', { name: 'Nobody' })
    expect(updated).toBeNull()
  })

  it('deleteBankEntry returns true on first delete, false on second', () => {
    const created = createBankEntry(db, makeEntry())
    expect(deleteBankEntry(db, created.id)).toBe(true)
    expect(deleteBankEntry(db, created.id)).toBe(false)
  })
})
