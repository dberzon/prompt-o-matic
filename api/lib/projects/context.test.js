import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { createProject, getProjectById } from '../db/repositories/projects.js'
import {
  PROJECT_ID_HEADER,
  PROJECT_ID_QUERY_PARAM,
  ProjectNotFoundError,
  resolveActiveProject,
} from './context.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-project-context-test-'))
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

describe('resolveActiveProject', () => {
  it('uses ?projectId= when present (wins over header and env)', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const seeded = getProjectById(db, 'proj_default')
    expect(seeded).not.toBeNull()
    const other = createProject(db, { slug: 'other_ctx', name: 'Other' })

    const req = {
      url: `/api/foo?${PROJECT_ID_QUERY_PARAM}=${encodeURIComponent(other.id)}&x=1`,
      headers: { [PROJECT_ID_HEADER]: 'should-not-win' },
    }
    const env = { QPB_DEFAULT_PROJECT_ID: 'proj_default' }

    expect(resolveActiveProject(db, { req, env })).toEqual(other)
    db.close()
  })

  it('falls back to x-qpb-project-id when query absent', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const other = createProject(db, { slug: 'header_ctx', name: 'H' })

    const req = {
      url: '/api/entities',
      headers: { [PROJECT_ID_HEADER]: other.id },
    }

    expect(resolveActiveProject(db, { req, env: {} })).toEqual(other)
    db.close()
  })

  it('falls back to env.QPB_DEFAULT_PROJECT_ID when query and header absent', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const other = createProject(db, { slug: 'env_ctx', name: 'E' })

    const req = { url: '/api/x', headers: {} }
    const env = { QPB_DEFAULT_PROJECT_ID: other.id }

    expect(resolveActiveProject(db, { req, env })).toEqual(other)
    db.close()
  })

  it("falls back to proj_default when query, header, and env are unset", () => {
    const db = createTempDb()
    initializeDatabase(db)
    const seeded = getProjectById(db, 'proj_default')
    expect(seeded).not.toBeNull()

    const req = { url: '/api/y', headers: {} }
    const env = {}

    expect(resolveActiveProject(db, { req, env })).toEqual(seeded)
    db.close()
  })

  it('rejects unknown project id with ProjectNotFoundError', () => {
    const db = createTempDb()
    initializeDatabase(db)

    const req = { url: `/api/z?${PROJECT_ID_QUERY_PARAM}=no_such_project`, headers: {} }

    expect(() => resolveActiveProject(db, { req, env: {} })).toThrow(ProjectNotFoundError)
    try {
      resolveActiveProject(db, { req, env: {} })
    } catch (e) {
      expect(e).toBeInstanceOf(ProjectNotFoundError)
      expect(e.projectId).toBe('no_such_project')
      expect(e.code).toBe('PROJECT_NOT_FOUND')
    }
    db.close()
  })

  it('treats empty query param as absent so header is used', () => {
    const db = createTempDb()
    initializeDatabase(db)
    const other = createProject(db, { slug: 'empty_q', name: 'Q' })

    const req = {
      url: `/api/a?${PROJECT_ID_QUERY_PARAM}=`,
      headers: { [PROJECT_ID_HEADER]: other.id },
    }

    expect(resolveActiveProject(db, { req, env: {} })).toEqual(other)
    db.close()
  })
})
