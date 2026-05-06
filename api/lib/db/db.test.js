import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  invalidCharacterProfiles,
  validCharacterProfile,
  validGeneratedImageRecord,
  validQwenImagePromptPack,
} from '../characters/fixtures.js'
import {
  createActorAudition,
  createActorCandidate,
  createBatchCandidate,
  createCharacter,
  createCharacterBatch,
  createGeneratedImageRecord,
  createPromptPack,
  deleteCharacter,
  getActorAudition,
  getActorCandidate,
  getBatchCandidate,
  getCharacter,
  getGeneratedImageRecord,
  getPromptPack,
  listGeneratedImageRecords,
  listCharacters,
  updateGeneratedImageRecord,
  updateCharacter,
  upsertComfyJob,
} from './repositories.js'
import { createSqliteDatabase, initializeDatabase } from './sqlite.js'

const tempDirs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-db-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  return { db, dbPath }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('sqlite canonical storage', () => {
  it('initializes required tables', () => {
    const { db } = createTempDb()
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('characters', 'prompt_packs', 'generated_images')
    `).all()
    const names = tables.map((row) => row.name).sort()
    expect(names).toEqual(['characters', 'generated_images', 'prompt_packs'])
    db.close()
  })

  it('creates, reads, lists, updates, and deletes character records', () => {
    const { db } = createTempDb()
    const created = createCharacter(db, {
      ...validCharacterProfile,
      id: 'char_repo_001',
      embeddingStatus: 'pending',
    })
    expect(created.id).toBe('char_repo_001')

    const fetched = getCharacter(db, 'char_repo_001')
    expect(fetched.embeddingStatus).toBe('pending')

    const listed = listCharacters(db, { projectId: validCharacterProfile.projectId })
    expect(listed.length).toBe(1)
    expect(listed[0].id).toBe('char_repo_001')

    const updated = updateCharacter(db, 'char_repo_001', {
      approved: false,
      embeddingStatus: 'failed',
    })
    expect(updated.approved).toBe(false)
    expect(updated.embeddingStatus).toBe('failed')

    const deleted = deleteCharacter(db, 'char_repo_001')
    expect(deleted).toBe(true)
    expect(getCharacter(db, 'char_repo_001')).toBeNull()
    db.close()
  })

  it('rejects invalid character payload before insert', () => {
    const { db } = createTempDb()
    expect(() => createCharacter(db, invalidCharacterProfiles.missingRequired)).toThrow()
    db.close()
  })

  it('inserts and reads prompt packs', () => {
    const { db } = createTempDb()
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_repo_001',
      characterId: 'char_repo_002',
    })
    const fetched = getPromptPack(db, pack.id)
    expect(fetched.id).toBe('pack_repo_001')
    expect(fetched.characterId).toBe('char_repo_002')
    db.close()
  })

  it('inserts and reads generated image records', () => {
    const { db } = createTempDb()
    const record = createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_repo_001',
      promptPackId: 'pack_repo_001',
    })
    const fetched = getGeneratedImageRecord(db, record.id)
    expect(fetched.id).toBe('img_repo_001')
    expect(fetched.promptPackId).toBe('pack_repo_001')
    db.close()
  })

  it('lifecycle_status column is authoritative over payload_json on read', () => {
    const { db } = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_lc_col', lifecycleStatus: 'auditioned' })

    // Directly advance the column without touching payload_json — simulates the column winning
    db.prepare("UPDATE characters SET lifecycle_status = 'ready' WHERE id = 'char_lc_col'").run()

    const fetched = getCharacter(db, 'char_lc_col')
    expect(fetched.lifecycleStatus).toBe('ready')

    const listed = listCharacters(db, {})
    const found = listed.find((c) => c.id === 'char_lc_col')
    expect(found.lifecycleStatus).toBe('ready')

    db.close()
  })

  it('embedding_status column is authoritative over payload_json on read', () => {
    const { db } = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_emb_col', embeddingStatus: 'not_indexed' })

    // Directly advance the column without touching payload_json — simulates the column winning
    db.prepare("UPDATE characters SET embedding_status = 'embedded' WHERE id = 'char_emb_col'").run()

    const fetched = getCharacter(db, 'char_emb_col')
    expect(fetched.embeddingStatus).toBe('embedded')

    const listed = listCharacters(db, {})
    const found = listed.find((c) => c.id === 'char_emb_col')
    expect(found.embeddingStatus).toBe('embedded')

    db.close()
  })

  it('lists generated image records by character and prompt pack', () => {
    const { db } = createTempDb()
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_repo_list_1',
      characterId: 'char_a',
      promptPackId: 'pack_a',
    })
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_repo_list_2',
      characterId: 'char_b',
      promptPackId: 'pack_b',
    })
    expect(listGeneratedImageRecords(db, { characterId: 'char_a' }).map((x) => x.id)).toContain('img_repo_list_1')
    expect(listGeneratedImageRecords(db, { promptPackId: 'pack_b' }).map((x) => x.id)).toContain('img_repo_list_2')
    db.close()
  })

  it('updates generated image approval and reject reason', () => {
    const { db } = createTempDb()
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'img_repo_patch_1',
      promptPackId: 'pack_patch_1',
      approved: false,
    })
    const approved = updateGeneratedImageRecord(db, 'img_repo_patch_1', { approved: true })
    expect(approved.approved).toBe(true)
    const rejected = updateGeneratedImageRecord(db, 'img_repo_patch_1', {
      approved: false,
      rejectedReason: 'bad hands',
    })
    expect(rejected.approved).toBe(false)
    expect(rejected.rejectedReason).toBe('bad hands')
    db.close()
  })

  it('listCharacters: filters by search (name match)', () => {
    const { db } = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_s1', name: 'Elena' })
    createCharacter(db, { ...validCharacterProfile, id: 'char_s2', name: 'Marcus' })
    const results = listCharacters(db, { search: 'marc' })
    expect(results.map((c) => c.id)).toEqual(['char_s2'])
    db.close()
  })

  it('listCharacters: filters by search (cinematicArchetype match)', () => {
    const { db } = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_a1', cinematicArchetype: 'quiet observer' })
    createCharacter(db, { ...validCharacterProfile, id: 'char_a2', cinematicArchetype: 'lone enforcer' })
    const results = listCharacters(db, { search: 'enforcer' })
    expect(results.map((c) => c.id)).toEqual(['char_a2'])
    db.close()
  })

  it('listCharacters: filters by gender (substring match)', () => {
    const { db } = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_g1', genderPresentation: 'female' })
    createCharacter(db, { ...validCharacterProfile, id: 'char_g2', genderPresentation: 'male' })
    const female = listCharacters(db, { gender: 'female' })
    expect(female.map((c) => c.id)).toEqual(['char_g1'])
    db.close()
  })

  it('listCharacters: filters by ageMin and ageMax', () => {
    const { db } = createTempDb()
    const base = { ...validCharacterProfile }
    createCharacter(db, { ...base, id: 'char_age1', age: 20, apparentAgeRange: { min: 18, max: 22 } })
    createCharacter(db, { ...base, id: 'char_age2', age: 35, apparentAgeRange: { min: 33, max: 37 } })
    createCharacter(db, { ...base, id: 'char_age3', age: 50, apparentAgeRange: { min: 48, max: 53 } })
    const mid = listCharacters(db, { ageMin: 30, ageMax: 40 })
    expect(mid.map((c) => c.id)).toEqual(['char_age2'])
    const young = listCharacters(db, { ageMax: 25 })
    expect(young.map((c) => c.id)).toEqual(['char_age1'])
    db.close()
  })

  it('listCharacters: combines search and gender filters', () => {
    const { db } = createTempDb()
    const base = { ...validCharacterProfile }
    createCharacter(db, { ...base, id: 'char_c1', name: 'Aria', genderPresentation: 'female' })
    createCharacter(db, { ...base, id: 'char_c2', name: 'Aria', genderPresentation: 'male' })
    createCharacter(db, { ...base, id: 'char_c3', name: 'Ben', genderPresentation: 'female' })
    const results = listCharacters(db, { search: 'aria', gender: 'female' })
    expect(results.map((c) => c.id)).toEqual(['char_c1'])
    db.close()
  })

  it('blocks sqlite initialization in APP_MODE=cloud', () => {
    expect(() => createSqliteDatabase({ env: { APP_MODE: 'cloud' }, dbPath: ':memory:' })).toThrow(
      'SQLite canonical storage is local-studio only',
    )
  })

  it('deleteCharacter cascades to all related tables', () => {
    const { db } = createTempDb()
    try {
      createCharacter(db, { ...validCharacterProfile, id: 'char_cascade' })
      const pack = createPromptPack(db, { ...validQwenImagePromptPack, id: 'pack_cascade', characterId: 'char_cascade' })
      createGeneratedImageRecord(db, { ...validGeneratedImageRecord, id: 'img_cascade', characterId: 'char_cascade', promptPackId: pack.id })
      upsertComfyJob(db, { id: 'job_cascade', promptId: 'prompt_cascade', characterId: 'char_cascade', viewType: 'front_portrait', jobType: 'portfolio', status: 'queued', createdAt: new Date().toISOString() })
      const actor = createActorCandidate(db, { id: 'actor_cascade', promptPackId: pack.id })
      const audition = createActorAudition(db, { id: 'audition_cascade', actorCandidateId: actor.id, bankEntryId: 'bank_x' })

      const batch = createCharacterBatch(db, { id: 'batch_cascade', request: {}, options: {}, provider: {}, summary: {}, status: 'completed' })
      const batchCand = createBatchCandidate(db, { batchId: batch.id, candidate: validCharacterProfile, classification: 'accepted', reviewStatus: 'saved', similarity: [] })
      db.prepare("UPDATE character_batch_candidates SET saved_character_id = 'char_cascade' WHERE id = ?").run(batchCand.id)

      const deleted = deleteCharacter(db, 'char_cascade')
      expect(deleted).toBe(true)
      expect(getCharacter(db, 'char_cascade')).toBeNull()
      expect(getPromptPack(db, pack.id)).toBeNull()
      expect(getGeneratedImageRecord(db, 'img_cascade')).toBeNull()
      expect(db.prepare("SELECT id FROM comfy_jobs WHERE id = 'job_cascade'").get()).toBeUndefined()
      expect(getActorCandidate(db, actor.id)).toBeNull()
      expect(getActorAudition(db, audition.id)).toBeNull()

      const detached = getBatchCandidate(db, batchCand.id)
      expect(detached.savedCharacterId).toBeNull()
      expect(detached.reviewStatus).toBe('approved')
    } finally {
      db.close()
    }
  })
})
