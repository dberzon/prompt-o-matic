import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../sqlite.js'
import {
  archiveProject,
  createProject,
  getProjectById,
  getProjectBySlug,
  listProjects,
  UniqueConstraintError,
  updateProject,
} from './projects.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-projects-repo-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  return db
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('projects repository', () => {
  it('createProject returns non-null id, slug, name, createdAt, updatedAt', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const rec = createProject(db, { slug: 'alpha_story', name: 'Alpha' })
    expect(rec).not.toBeNull()
    expect(rec.id).toBeTruthy()
    expect(rec.slug).toBe('alpha_story')
    expect(rec.name).toBe('Alpha')
    expect(rec.createdAt).toBeTruthy()
    expect(rec.updatedAt).toBeTruthy()
    expect(rec.createdAt).toBe(rec.updatedAt)
    expect(rec.active).toBe(true)
    db.close()
  })

  it('createProject with duplicate slug throws UniqueConstraintError', () => {
    const db = createTempDb()
    initializeDatabase(db)
    createProject(db, { slug: 'dup_slug', name: 'First' })
    expect(() => createProject(db, { slug: 'dup_slug', name: 'Second' })).toThrow(UniqueConstraintError)
    try {
      createProject(db, { slug: 'dup_slug', name: 'Third' })
    } catch (e) {
      expect(e).toBeInstanceOf(UniqueConstraintError)
      expect(e.code).toBe('SQLITE_CONSTRAINT_UNIQUE')
    }
    db.close()
  })

  it('listProjects({ active: true }) excludes archived projects', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const live = createProject(db, { slug: 'live_proj', name: 'Live' })
    const archived = createProject(db, { slug: 'gone_proj', name: 'Gone' })
    archiveProject(db, archived.id)

    const activeOnly = listProjects(db, { active: true })
    const ids = activeOnly.map((p) => p.id)
    expect(ids).toContain(live.id)
    expect(ids).not.toContain(archived.id)

    const inactiveOnly = listProjects(db, { active: false })
    expect(inactiveOnly.some((p) => p.id === archived.id)).toBe(true)

    const all = listProjects(db)
    expect(all.some((p) => p.id === live.id)).toBe(true)
    expect(all.some((p) => p.id === archived.id)).toBe(true)
    db.close()
  })

  it('CRUD round-trip: get by id/slug, update, payload and eraEntityId', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const created = createProject(db, {
      slug: 'crud_one',
      name: 'CRUD',
      eraEntityId: null,
      payload: { version: 1 },
    })
    expect(getProjectById(db, created.id)).toEqual(created)
    expect(getProjectBySlug(db, 'crud_one')).toEqual(created)

    const updated = updateProject(db, created.id, {
      name: 'CRUD Renamed',
      eraEntityId: 'ent_some',
      payload: { version: 2 },
    })
    expect(updated.name).toBe('CRUD Renamed')
    expect(updated.eraEntityId).toBe('ent_some')
    expect(updated.payload).toEqual({ version: 2 })
    expect(updated.updatedAt >= created.updatedAt).toBe(true)

    expect(getProjectById(db, 'missing')).toBeNull()
    expect(getProjectBySlug(db, 'nope')).toBeNull()
    expect(updateProject(db, 'missing', { name: 'x' })).toBeNull()
    db.close()
  })

  it('updateProject duplicate slug throws UniqueConstraintError', () => {
    const db = createTempDb()
    initializeDatabase(db)
    createProject(db, { slug: 'slug_a', name: 'A' })
    const b = createProject(db, { slug: 'slug_b', name: 'B' })
    expect(() => updateProject(db, b.id, { slug: 'slug_a' })).toThrow(UniqueConstraintError)
    db.close()
  })

  it('re-exports path api/lib/projects/repository.js', async () => {
    const mod = await import('../../projects/repository.js')
    expect(mod.createProject).toBeDefined()
    expect(mod.UniqueConstraintError).toBe(UniqueConstraintError)
  })
})
