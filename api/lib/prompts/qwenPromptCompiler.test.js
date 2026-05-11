import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createCharacter,
  createBatchCandidate,
  createCharacterBatch,
  createEntity,
  listPromptPacks,
  writeAttribute,
} from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { validCharacterProfile } from '../characters/fixtures.js'
import {
  compileBatchPromptPacks,
  compileCharacterPromptPacks,
  compileEntityPromptPacks,
  listPromptPacksForCharacter,
} from './qwenPromptCompiler.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-pack-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

afterEach(() => {
  while (openDbs.length > 0) {
    const db = openDbs.pop()
    try {
      db.close()
    } catch {}
  }
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('qwen prompt compiler', () => {
  it('compiles one valid character into valid prompt pack', () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_prompt_1' })
    const result = compileCharacterPromptPacks({
      db,
      input: {
        characterId: 'char_prompt_1',
        views: ['front_portrait'],
      },
    })
    expect(result.ok).toBe(true)
    expect(result.packs.length).toBe(1)
    expect(result.packs[0].characterId).toBe('char_prompt_1')
    db.close()
  })

  it('compiles one character into multiple views with differences', () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_prompt_2' })
    const result = compileCharacterPromptPacks({
      db,
      input: {
        characterId: 'char_prompt_2',
        views: ['front_portrait', 'profile_portrait'],
        options: { persist: false },
      },
    })
    expect(result.packs.length).toBe(2)
    expect(result.packs[0].camera).not.toBe(result.packs[1].camera)
    db.close()
  })

  it('includes negative prompt when requested', () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_prompt_3' })
    const result = compileCharacterPromptPacks({
      db,
      input: {
        characterId: 'char_prompt_3',
        views: ['front_portrait'],
        options: { includeNegativePrompt: true, persist: false },
      },
    })
    expect(result.packs[0].negativePrompt).toContain('cgi')
    db.close()
  })

  it('persists prompt packs and can read back', () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_prompt_4' })
    compileCharacterPromptPacks({
      db,
      input: { characterId: 'char_prompt_4', views: ['front_portrait', 'audition_still'] },
    })
    const listed = listPromptPacksForCharacter({ db, characterId: 'char_prompt_4' })
    expect(listed.items.length).toBe(2)
    db.close()
  })

  it('compile-batch filters by candidate status', () => {
    const db = createTempDb()
    const batch = createCharacterBatch(db, {
      request: { count: 2 },
      options: {},
      provider: {},
      summary: {},
      status: 'generated',
    })
    createBatchCandidate(db, {
      batchId: batch.id,
      candidate: { ...validCharacterProfile, id: 'cand_saved' },
      classification: 'accepted',
      reviewStatus: 'saved',
    })
    createBatchCandidate(db, {
      batchId: batch.id,
      candidate: { ...validCharacterProfile, id: 'cand_pending' },
      classification: 'accepted',
      reviewStatus: 'pending',
    })

    const result = compileBatchPromptPacks({
      db,
      input: {
        batchId: batch.id,
        candidateStatus: 'saved',
        views: ['front_portrait'],
        options: { persist: false },
      },
    })
    expect(result.totalPacks).toBe(1)
    expect(result.packs[0].characterId).toBe('cand_saved')
    db.close()
  })

  it('invalid character fails cleanly', () => {
    const db = createTempDb()
    expect(() => compileCharacterPromptPacks({
      db,
      input: { character: { id: 'bad' }, views: ['front_portrait'] },
    })).toThrow()
    db.close()
  })

  it('compiles prompt packs from canon and inferred entity attributes', () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_prompt_1', type: 'character', name: 'Ruslan' })
    writeAttribute(db, { entityId: 'ent_prompt_1', key: 'eyes', value: 'small piggy eyes', provenance: 'canon' })
    writeAttribute(db, { entityId: 'ent_prompt_1', key: 'wardrobe', value: 'worn student jacket', provenance: 'inferred' })
    writeAttribute(db, { entityId: 'ent_prompt_1', key: 'visual.descriptor', value: 'frontal portrait, neutral expression', provenance: 'inferred' })
    writeAttribute(db, { entityId: 'ent_prompt_1', key: 'mood', value: 'wistful', provenance: 'suggested' })

    const result = compileEntityPromptPacks({
      db,
      entityId: 'ent_prompt_1',
      input: { views: ['front_portrait'], options: { persist: false } },
    })

    expect(result.ok).toBe(true)
    expect(result.entityId).toBe('ent_prompt_1')
    expect(result.packs).toHaveLength(1)
    expect(result.packs[0].characterId).toBe('ent_prompt_1')
    expect(result.packs[0].positivePrompt).toContain('small piggy eyes')
    expect(result.packs[0].positivePrompt).toContain('worn student jacket')
    expect(result.packs[0].positivePrompt).toContain('visual descriptor: frontal portrait, neutral expression')
    expect(result.packs[0].positivePrompt).not.toContain('wistful')
    db.close()
  })

  it('returns 404 when entity is missing', () => {
    const db = createTempDb()
    expect(() => compileEntityPromptPacks({
      db,
      entityId: 'ent_missing',
      input: { views: ['front_portrait'], options: { persist: false } },
    })).toThrow('Entity not found')
    db.close()
  })
})
