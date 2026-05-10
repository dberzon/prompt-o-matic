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
  archiveEntity,
  createActorAudition,
  createActorCandidate,
  createBatchCandidate,
  createCharacter,
  createCharacterBatch,
  createEntity,
  createGeneratedImageRecord,
  createPromptPack,
  deleteCharacter,
  getEntity,
  listEntities,
  updateEntity,
  writeAttribute,
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


describe('entity layer schema migrations', () => {
  it('creates entities, entity_attributes, entity_relationships, visual_anchors tables', () => {
    const { db } = createTempDb()
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table'
        AND name IN ('entities', 'entity_attributes', 'entity_relationships', 'visual_anchors')
    `).all()
    const names = tables.map((row) => row.name).sort()
    expect(names).toEqual(['entities', 'entity_attributes', 'entity_relationships', 'visual_anchors'])
    db.close()
  })

  it('entities: enforces type CHECK', () => {
    const { db } = createTempDb()
    const now = new Date().toISOString()
    db.prepare("INSERT INTO entities (id, type, name, created_at, updated_at) VALUES ('e1', 'character', 'Elena', ?, ?)").run(now, now)
    expect(() =>
      db.prepare("INSERT INTO entities (id, type, name, created_at, updated_at) VALUES ('e2', 'invalid_type', 'X', ?, ?)").run(now, now),
    ).toThrow(/CHECK/i)
    db.close()
  })

  it('entities: indexes on type and name exist', () => {
    const { db } = createTempDb()
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'entities'").all().map((r) => r.name)
    expect(idx).toContain('idx_entities_type')
    expect(idx).toContain('idx_entities_name')
    db.close()
  })

  it('entity_attributes: enforces provenance CHECK', () => {
    const { db } = createTempDb()
    const now = new Date().toISOString()
    db.prepare("INSERT INTO entity_attributes (id, entity_id, key, value, provenance, created_at) VALUES ('a1', 'e1', 'eyes', 'green', 'canon', ?)").run(now)
    expect(() =>
      db.prepare("INSERT INTO entity_attributes (id, entity_id, key, value, provenance, created_at) VALUES ('a2', 'e1', 'eyes', 'green', 'guess', ?)").run(now),
    ).toThrow(/CHECK/i)
    db.close()
  })

  it('entity_attributes: provenance NOT NULL is enforced', () => {
    const { db } = createTempDb()
    const now = new Date().toISOString()
    expect(() =>
      db.prepare("INSERT INTO entity_attributes (id, entity_id, key, value, created_at) VALUES ('a3', 'e1', 'eyes', 'green', ?)").run(now),
    ).toThrow(/NOT NULL/i)
    db.close()
  })

  it('entity_relationships: enforces provenance CHECK', () => {
    const { db } = createTempDb()
    db.prepare("INSERT INTO entity_relationships (id, from_id, to_id, type, provenance) VALUES ('r1', 'e1', 'e2', 'parent_of', 'canon')").run()
    expect(() =>
      db.prepare("INSERT INTO entity_relationships (id, from_id, to_id, type, provenance) VALUES ('r2', 'e1', 'e2', 'parent_of', 'maybe')").run(),
    ).toThrow(/CHECK/i)
    db.close()
  })

  it('visual_anchors: enforces type CHECK and partial unique on is_primary', () => {
    const { db } = createTempDb()
    const now = new Date().toISOString()
    db.prepare("INSERT INTO visual_anchors (id, entity_id, type, is_primary, created_at) VALUES ('v1', 'e1', 'reference_image', 1, ?)").run(now)
    db.prepare("INSERT INTO visual_anchors (id, entity_id, type, is_primary, created_at) VALUES ('v2', 'e1', 'reference_image', 0, ?)").run(now)
    expect(() =>
      db.prepare("INSERT INTO visual_anchors (id, entity_id, type, is_primary, created_at) VALUES ('v3', 'e1', 'bad_type', 0, ?)").run(now),
    ).toThrow(/CHECK/i)
    expect(() =>
      db.prepare("INSERT INTO visual_anchors (id, entity_id, type, is_primary, created_at) VALUES ('v4', 'e1', 'reference_image', 1, ?)").run(now),
    ).toThrow(/UNIQUE/i)
    // Different entity may also have a primary
    db.prepare("INSERT INTO visual_anchors (id, entity_id, type, is_primary, created_at) VALUES ('v5', 'e2', 'reference_image', 1, ?)").run(now)
    db.close()
  })
})


describe('entity repository (createEntity / getEntity / listEntities / updateEntity / archiveEntity)', () => {
  it('creates and retrieves an entity', () => {
    const { db } = createTempDb()
    const created = createEntity(db, { id: 'ent_001', type: 'character', name: 'Elena' })
    expect(created.id).toBe('ent_001')
    expect(created.type).toBe('character')
    expect(created.name).toBe('Elena')
    expect(created.archivedAt).toBeNull()
    expect(created.createdAt).toBe(created.updatedAt)
    const fetched = getEntity(db, 'ent_001')
    expect(fetched).toEqual(created)
    db.close()
  })

  it('createEntity assigns a UUID when id is omitted', () => {
    const { db } = createTempDb()
    const a = createEntity(db, { type: 'environment', name: 'Wharf' })
    const b = createEntity(db, { type: 'environment', name: 'Wharf' })
    expect(a.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
    db.close()
  })

  it('createEntity rejects invalid type', () => {
    const { db } = createTempDb()
    expect(() => createEntity(db, { type: 'spaceship', name: 'X' })).toThrow(/type must be one of/)
    db.close()
  })

  it('createEntity requires a name', () => {
    const { db } = createTempDb()
    expect(() => createEntity(db, { type: 'character' })).toThrow(/name is required/)
    db.close()
  })

  it('listEntities filters by type and excludes archived by default', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_c1', type: 'character', name: 'C1' })
    createEntity(db, { id: 'e_c2', type: 'character', name: 'C2' })
    createEntity(db, { id: 'e_env', type: 'environment', name: 'Forest' })
    archiveEntity(db, 'e_c2')
    const characters = listEntities(db, { type: 'character' }).map((e) => e.id).sort()
    expect(characters).toEqual(['e_c1'])
    const all = listEntities(db).map((e) => e.id).sort()
    expect(all).toEqual(['e_c1', 'e_env'])
    const withArchived = listEntities(db, { includeArchived: true }).map((e) => e.id).sort()
    expect(withArchived).toEqual(['e_c1', 'e_c2', 'e_env'])
    db.close()
  })

  it('updateEntity changes name and bumps updated_at', () => {
    const { db } = createTempDb()
    const created = createEntity(db, { id: 'ent_upd', type: 'prop', name: 'Lantern' })
    // Force a measurable gap so updated_at changes
    const updated = updateEntity(db, 'ent_upd', { name: 'Brass Lantern' })
    expect(updated.name).toBe('Brass Lantern')
    expect(updated.type).toBe('prop')
    expect(updated.createdAt).toBe(created.createdAt)
    db.close()
  })

  it('updateEntity returns null for unknown id', () => {
    const { db } = createTempDb()
    expect(updateEntity(db, 'does_not_exist', { name: 'X' })).toBeNull()
    db.close()
  })

  it('updateEntity rejects invalid type', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'ent_bad', type: 'character', name: 'X' })
    expect(() => updateEntity(db, 'ent_bad', { type: 'mecha' })).toThrow(/type must be one of/)
    db.close()
  })

  it('archiveEntity sets archived_at and is idempotent', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'ent_arc', type: 'institution', name: 'Guild' })
    expect(archiveEntity(db, 'ent_arc')).toBe(true)
    const archived = getEntity(db, 'ent_arc')
    expect(archived.archivedAt).toBeTruthy()
    // Second archive returns false (already archived)
    expect(archiveEntity(db, 'ent_arc')).toBe(false)
    expect(archiveEntity(db, 'unknown_id')).toBe(false)
    db.close()
  })

  it('archiveEntity preserves history (no DELETE)', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'ent_hist', type: 'character', name: 'Ghost' })
    archiveEntity(db, 'ent_hist')
    const fetched = getEntity(db, 'ent_hist')
    expect(fetched).not.toBeNull()
    expect(fetched.name).toBe('Ghost')
    db.close()
  })
})

describe('writeAttribute (provenance enforcement, supersedes chain)', () => {
  it('writes a canon attribute and round-trips the value', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_attr', type: 'character', name: 'Elena' })
    const attr = writeAttribute(db, {
      entityId: 'e_attr',
      key: 'eyes',
      value: 'green',
      provenance: 'canon',
    })
    expect(attr.id).toBeTruthy()
    expect(attr.entityId).toBe('e_attr')
    expect(attr.key).toBe('eyes')
    expect(attr.value).toBe('green')
    expect(attr.provenance).toBe('canon')
    expect(attr.confidence).toBeNull()
    expect(attr.sourceStage).toBeNull()
    expect(attr.supersededBy).toBeNull()
    db.close()
  })

  it('JSON-encodes object values', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_obj', type: 'character', name: 'Marcus' })
    const attr = writeAttribute(db, {
      entityId: 'e_obj',
      key: 'wardrobe',
      value: { jacket: 'leather', boots: 'tan' },
      provenance: 'inferred',
      confidence: 0.7,
      sourceStage: 5,
    })
    expect(attr.value).toEqual({ jacket: 'leather', boots: 'tan' })
    expect(attr.confidence).toBe(0.7)
    expect(attr.sourceStage).toBe(5)
    db.close()
  })

  it('throws if provenance is missing', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_p', type: 'character', name: 'X' })
    expect(() =>
      writeAttribute(db, { entityId: 'e_p', key: 'eyes', value: 'green' }),
    ).toThrow(/provenance is required/)
    db.close()
  })

  it('throws on invalid provenance before hitting the DB', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_pi', type: 'character', name: 'X' })
    expect(() =>
      writeAttribute(db, { entityId: 'e_pi', key: 'eyes', value: 'green', provenance: 'guess' }),
    ).toThrow(/provenance must be one of/)
    db.close()
  })

  it('requires entityId and key', () => {
    const { db } = createTempDb()
    expect(() => writeAttribute(db, { key: 'eyes', value: 'g', provenance: 'canon' })).toThrow(/entityId is required/)
    expect(() =>
      writeAttribute(db, { entityId: 'e1', value: 'g', provenance: 'canon' }),
    ).toThrow(/key is required/)
    db.close()
  })

  it('chains supersedes: old attribute gets superseded_by = new id', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_sup', type: 'character', name: 'X' })
    const v1 = writeAttribute(db, {
      entityId: 'e_sup',
      key: 'eyes',
      value: 'blue',
      provenance: 'inferred',
    })
    const v2 = writeAttribute(db, {
      entityId: 'e_sup',
      key: 'eyes',
      value: 'green',
      provenance: 'canon',
      supersedes: v1.id,
    })
    const v1Reloaded = db.prepare('SELECT * FROM entity_attributes WHERE id = ?').get(v1.id)
    expect(v1Reloaded.superseded_by).toBe(v2.id)
    expect(v2.supersededBy).toBeNull()
    db.close()
  })

  it('throws if supersedes target does not exist (and rolls back the insert)', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_sup_bad', type: 'character', name: 'X' })
    expect(() =>
      writeAttribute(db, {
        entityId: 'e_sup_bad',
        key: 'eyes',
        value: 'green',
        provenance: 'canon',
        supersedes: 'nonexistent_attr',
      }),
    ).toThrow(/supersedes target nonexistent_attr not found/)
    const count = db.prepare('SELECT COUNT(*) AS n FROM entity_attributes WHERE entity_id = ?').get('e_sup_bad').n
    expect(count).toBe(0)
    db.close()
  })
})
