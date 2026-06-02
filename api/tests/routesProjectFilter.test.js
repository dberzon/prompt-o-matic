import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import characterBankHandler from '../character-bank.js'
import charactersHandler from '../characters.js'
import entitiesHandler from '../entities.js'
import generatedImagesHandler from '../generated-images.js'
import promptPacksHandler from '../prompt-packs.js'
import {
  createBankEntry,
  createCharacter,
  createEntity,
  createGeneratedImageRecord,
  createPromptPack,
} from '../lib/db/repositories.js'
import { createProject } from '../lib/db/repositories/projects.js'
import { createSqliteDatabase, initializeDatabase } from '../lib/db/sqlite.js'
import {
  validCharacterProfile,
  validGeneratedImageRecord,
  validQwenImagePromptPack,
} from '../lib/characters/fixtures.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-routes-project-filter-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(obj) {
      this.payload = obj
      return this
    },
    writeHead() {},
    end() {},
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
  delete process.env.ENABLE_GENERATED_IMAGES_API
})

describe('routes project filter (?projectId=)', () => {
  it('entities, characters, prompt-packs, generated-images, character-bank honor filter + NULL rows', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    process.env.ENABLE_GENERATED_IMAGES_API = 'true'
    const db = ensureDb(dbPath)
    const projA = createProject(db, { slug: 'rt_proj_a', name: 'RT A' })
    const projB = createProject(db, { slug: 'rt_proj_b', name: 'RT B' })

    createEntity(db, { id: 'ent_a', type: 'character', name: 'EA', projectId: projA.id })
    createEntity(db, { id: 'ent_b', type: 'character', name: 'EB', projectId: projB.id })
    createEntity(db, { id: 'ent_null', type: 'character', name: 'ENull', projectId: null })

    const charShared = 'char_rt_shared'
    createCharacter(db, {
      ...validCharacterProfile,
      id: charShared,
      slug: 'char_rt_shared',
      name: 'Shared Face',
      projectId: projA.id,
    })
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_only_b',
      slug: 'char_only_b',
      name: 'Only B',
      projectId: projB.id,
    })
    createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_null',
      slug: 'char_null',
      name: 'Null Char',
      projectId: null,
    })

    createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_a',
      characterId: charShared,
      projectId: projA.id,
    })
    createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_b',
      characterId: charShared,
      projectId: projB.id,
      positivePrompt: 'different pack b',
    })
    createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_null',
      characterId: charShared,
      projectId: null,
      positivePrompt: 'null scoped pack',
    })

    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_a',
      characterId: charShared,
      promptPackId: 'pack_a',
      projectId: projA.id,
    })
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_b',
      characterId: charShared,
      promptPackId: 'pack_b',
      projectId: projB.id,
    })
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_null',
      characterId: charShared,
      promptPackId: 'pack_null',
      projectId: null,
    })

    createBankEntry(db, {
      id: 'bank_a',
      slug: 'bank_entry_a',
      name: 'Bank A',
      description: 'd',
      createdAt: '2026-04-28T12:00:00.000Z',
      updatedAt: '2026-04-28T12:00:00.000Z',
      projectId: projA.id,
    })
    createBankEntry(db, {
      id: 'bank_b',
      slug: 'bank_entry_b',
      name: 'Bank B',
      description: 'd',
      createdAt: '2026-04-28T12:01:00.000Z',
      updatedAt: '2026-04-28T12:01:00.000Z',
      projectId: projB.id,
    })
    createBankEntry(db, {
      id: 'bank_null',
      slug: 'bank_entry_null',
      name: 'Bank Null',
      description: 'd',
      createdAt: '2026-04-28T12:02:00.000Z',
      updatedAt: '2026-04-28T12:02:00.000Z',
      projectId: null,
    })

    const qA = `projectId=${encodeURIComponent(projA.id)}`

    const entRes = mockRes()
    await entitiesHandler({ method: 'GET', url: `/api/entities?${qA}` }, entRes)
    expect(entRes.statusCode).toBe(200)
    expect(new Set(entRes.payload.items.map((x) => x.id))).toEqual(new Set(['ent_a', 'ent_null']))

    const charRes = mockRes()
    await charactersHandler({ method: 'GET', query: { projectId: projA.id } }, charRes)
    expect(charRes.statusCode).toBe(200)
    expect(new Set(charRes.payload.items.map((x) => x.id))).toEqual(new Set([charShared, 'char_null']))

    const packRes = mockRes()
    await promptPacksHandler({
      method: 'GET',
      query: { characterId: charShared, projectId: projA.id },
    }, packRes)
    expect(packRes.statusCode).toBe(200)
    expect(new Set(packRes.payload.items.map((x) => x.id))).toEqual(new Set(['pack_a', 'pack_null']))

    const imgRes = mockRes()
    await generatedImagesHandler({
      method: 'GET',
      query: { characterId: charShared, projectId: projA.id },
    }, imgRes)
    expect(imgRes.statusCode).toBe(200)
    expect(new Set(imgRes.payload.items.map((x) => x.id))).toEqual(new Set(['img_a', 'img_null']))

    const charDetailRes = mockRes()
    await charactersHandler({
      method: 'GET',
      query: { id: charShared, projectId: projA.id },
    }, charDetailRes)
    expect(charDetailRes.statusCode).toBe(200)
    expect(charDetailRes.payload.item.id).toBe(charShared)
    expect(charDetailRes.payload.item.slug).toBe('char_rt_shared')
    expect(new Set(charDetailRes.payload.item.images.map((x) => x.id))).toEqual(new Set(['img_a', 'img_null']))

    const charDetailWrongProject = mockRes()
    await charactersHandler({
      method: 'GET',
      query: { id: 'char_only_b', projectId: projA.id },
    }, charDetailWrongProject)
    expect(charDetailWrongProject.statusCode).toBe(404)

    const bankRes = mockRes()
    await characterBankHandler({ method: 'GET', url: `/api/character-bank?${qA}` }, bankRes)
    expect(bankRes.statusCode).toBe(200)
    expect(new Set(bankRes.payload.items.map((x) => x.id))).toEqual(new Set(['bank_a', 'bank_null']))

    const entNoFilter = mockRes()
    await entitiesHandler({ method: 'GET', url: '/api/entities' }, entNoFilter)
    expect(entNoFilter.statusCode).toBe(200)
    expect(entNoFilter.payload.items.length).toBeGreaterThanOrEqual(3)

    const ent404 = mockRes()
    await entitiesHandler({ method: 'GET', url: `/api/entities/ent_b?${qA}` }, ent404)
    expect(ent404.statusCode).toBe(404)

    const postEnt = mockRes()
    await entitiesHandler({
      method: 'POST',
      url: '/api/entities',
      body: { id: 'ent_posted', type: 'prop', name: 'Posted', projectId: projB.id },
    }, postEnt)
    expect(postEnt.statusCode).toBe(200)
    expect(postEnt.payload.item.projectId).toBe(projB.id)
  })
})
