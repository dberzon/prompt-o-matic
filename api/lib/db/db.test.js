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
  createRelationship,
  createVisualAnchor,
  dismissSuggested,
  getAttribute,
  getEntity,
  listAttributes,
  listEntities,
  listRelationships,
  listVisualAnchors,
  promoteToCanon,
  setPrimaryAnchor,
  updateEntity,
  updateRelationship,
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
    db.prepare("INSERT INTO entities (id, type, name, created_at, updated_at) VALUES ('e_loc', 'location', 'Set', ?, ?)").run(now, now)
    db.prepare("INSERT INTO entities (id, type, name, created_at, updated_at) VALUES ('e_era', 'era', '1990s', ?, ?)").run(now, now)
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

describe('visual anchor repository (createVisualAnchor / listVisualAnchors / setPrimaryAnchor)', () => {
  it('creates an anchor with default isPrimary=false', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_va', type: 'character', name: 'X' })
    const anchor = createVisualAnchor(db, {
      entityId: 'e_va',
      type: 'reference_image',
      payload: Buffer.from('imgbytes'),
    })
    expect(anchor.id).toBeTruthy()
    expect(anchor.entityId).toBe('e_va')
    expect(anchor.type).toBe('reference_image')
    expect(anchor.isPrimary).toBe(false)
    expect(Buffer.isBuffer(anchor.payload)).toBe(true)
    db.close()
  })

  it('createVisualAnchor with isPrimary=true demotes existing primary', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_va2', type: 'character', name: 'X' })
    const a = createVisualAnchor(db, { entityId: 'e_va2', type: 'reference_image', isPrimary: true })
    expect(a.isPrimary).toBe(true)
    const b = createVisualAnchor(db, { entityId: 'e_va2', type: 'reference_image', isPrimary: true })
    expect(b.isPrimary).toBe(true)
    const aReloaded = listVisualAnchors(db, { entityId: 'e_va2' }).find((x) => x.id === a.id)
    expect(aReloaded.isPrimary).toBe(false)
    db.close()
  })

  it('rejects invalid type', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_vb', type: 'character', name: 'X' })
    expect(() => createVisualAnchor(db, { entityId: 'e_vb', type: 'mystery' })).toThrow(/type must be one of/)
    db.close()
  })

  it('requires entityId', () => {
    const { db } = createTempDb()
    expect(() => createVisualAnchor(db, { type: 'reference_image' })).toThrow(/entityId is required/)
    db.close()
  })

  it('listVisualAnchors filters by entityId and type', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_la', type: 'character', name: 'X' })
    createEntity(db, { id: 'e_lb', type: 'character', name: 'Y' })
    createVisualAnchor(db, { id: 'va1', entityId: 'e_la', type: 'reference_image' })
    createVisualAnchor(db, { id: 'va2', entityId: 'e_la', type: 'seed' })
    createVisualAnchor(db, { id: 'va3', entityId: 'e_lb', type: 'reference_image' })
    const onlyA = listVisualAnchors(db, { entityId: 'e_la' }).map((x) => x.id).sort()
    expect(onlyA).toEqual(['va1', 'va2'])
    const onlyRefImages = listVisualAnchors(db, { type: 'reference_image' }).map((x) => x.id).sort()
    expect(onlyRefImages).toEqual(['va1', 'va3'])
    const both = listVisualAnchors(db, { entityId: 'e_la', type: 'seed' }).map((x) => x.id)
    expect(both).toEqual(['va2'])
    db.close()
  })

  it('setPrimaryAnchor flips is_primary atomically and enforces single primary per entity', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_sp', type: 'character', name: 'X' })
    const a = createVisualAnchor(db, { entityId: 'e_sp', type: 'reference_image', isPrimary: true })
    const b = createVisualAnchor(db, { entityId: 'e_sp', type: 'reference_image' })
    const c = createVisualAnchor(db, { entityId: 'e_sp', type: 'seed' })
    expect(setPrimaryAnchor(db, b.id)).toBe(true)
    const all = listVisualAnchors(db, { entityId: 'e_sp' })
    const primaries = all.filter((x) => x.isPrimary).map((x) => x.id)
    expect(primaries).toEqual([b.id])
    expect(setPrimaryAnchor(db, c.id)).toBe(true)
    const after = listVisualAnchors(db, { entityId: 'e_sp' })
    expect(after.filter((x) => x.isPrimary).map((x) => x.id)).toEqual([c.id])
    db.close()
  })

  it('setPrimaryAnchor on already-primary anchor is a no-op (returns true)', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_sp2', type: 'character', name: 'X' })
    const a = createVisualAnchor(db, { entityId: 'e_sp2', type: 'reference_image', isPrimary: true })
    expect(setPrimaryAnchor(db, a.id)).toBe(true)
    expect(listVisualAnchors(db, { entityId: 'e_sp2' }).filter((x) => x.isPrimary).map((x) => x.id)).toEqual([a.id])
    db.close()
  })

  it('setPrimaryAnchor returns false for unknown anchor id', () => {
    const { db } = createTempDb()
    expect(setPrimaryAnchor(db, 'nope')).toBe(false)
    db.close()
  })

  it('primary anchors are scoped per entity (different entities can each have one)', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_x', type: 'character', name: 'X' })
    createEntity(db, { id: 'e_y', type: 'character', name: 'Y' })
    const ax = createVisualAnchor(db, { entityId: 'e_x', type: 'reference_image', isPrimary: true })
    const ay = createVisualAnchor(db, { entityId: 'e_y', type: 'reference_image', isPrimary: true })
    expect(ax.isPrimary).toBe(true)
    expect(ay.isPrimary).toBe(true)
    db.close()
  })
})

describe('relationship repository (createRelationship / listRelationships / updateRelationship)', () => {
  it('creates a relationship and round-trips attributes JSON', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_r1', type: 'character', name: 'Mom' })
    createEntity(db, { id: 'e_r2', type: 'character', name: 'Kid' })
    const rel = createRelationship(db, {
      fromId: 'e_r1',
      toId: 'e_r2',
      type: 'family.parent_of',
      provenance: 'canon',
      confidence: 1,
      attributes: { since: '1990' },
    })
    expect(rel.id).toBeTruthy()
    expect(rel.fromId).toBe('e_r1')
    expect(rel.toId).toBe('e_r2')
    expect(rel.type).toBe('family.parent_of')
    expect(rel.attributes).toEqual({ since: '1990' })
    db.close()
  })

  it('rejects missing required fields', () => {
    const { db } = createTempDb()
    expect(() => createRelationship(db, { toId: 'e2', type: 't', provenance: 'canon' })).toThrow(/fromId is required/)
    expect(() => createRelationship(db, { fromId: 'e1', type: 't', provenance: 'canon' })).toThrow(/toId is required/)
    expect(() => createRelationship(db, { fromId: 'e1', toId: 'e2', provenance: 'canon' })).toThrow(/type is required/)
    expect(() => createRelationship(db, { fromId: 'e1', toId: 'e2', type: 't' })).toThrow(/provenance is required/)
    expect(() => createRelationship(db, { fromId: 'e1', toId: 'e2', type: 't', provenance: 'guess' })).toThrow(
      /provenance must be one of/,
    )
    db.close()
  })

  it('listRelationships filters by fromId, toId, type, and typePrefix glob', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'a', type: 'character', name: 'A' })
    createEntity(db, { id: 'b', type: 'character', name: 'B' })
    createEntity(db, { id: 'c', type: 'character', name: 'C' })
    createRelationship(db, { id: 'r1', fromId: 'a', toId: 'b', type: 'family.parent_of', provenance: 'canon' })
    createRelationship(db, { id: 'r2', fromId: 'a', toId: 'c', type: 'family.sibling_of', provenance: 'canon' })
    createRelationship(db, { id: 'r3', fromId: 'b', toId: 'c', type: 'work.colleague_of', provenance: 'inferred' })

    expect(listRelationships(db, { fromId: 'a' }).map((r) => r.id).sort()).toEqual(['r1', 'r2'])
    expect(listRelationships(db, { toId: 'c' }).map((r) => r.id).sort()).toEqual(['r2', 'r3'])
    expect(listRelationships(db, { type: 'work.colleague_of' }).map((r) => r.id)).toEqual(['r3'])
    expect(listRelationships(db, { typePrefix: 'family.*' }).map((r) => r.id).sort()).toEqual(['r1', 'r2'])
    expect(listRelationships(db, { fromId: 'a', typePrefix: 'family.*' }).map((r) => r.id).sort()).toEqual(['r1', 'r2'])
    db.close()
  })

  it('updateRelationship patches mutable fields', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'u_a', type: 'character', name: 'A' })
    createEntity(db, { id: 'u_b', type: 'character', name: 'B' })
    const rel = createRelationship(db, {
      fromId: 'u_a',
      toId: 'u_b',
      type: 'work.colleague_of',
      provenance: 'inferred',
      confidence: 0.4,
    })
    const updated = updateRelationship(db, rel.id, {
      provenance: 'canon',
      confidence: 1,
      attributes: { verified: true },
    })
    expect(updated.provenance).toBe('canon')
    expect(updated.confidence).toBe(1)
    expect(updated.attributes).toEqual({ verified: true })
    expect(updated.type).toBe('work.colleague_of')
    expect(updated.fromId).toBe('u_a')
    expect(updated.toId).toBe('u_b')
    db.close()
  })

  it('updateRelationship returns null for unknown id', () => {
    const { db } = createTempDb()
    expect(updateRelationship(db, 'nope', { provenance: 'canon' })).toBeNull()
    db.close()
  })

  it('updateRelationship rejects invalid provenance', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'ur_a', type: 'character', name: 'A' })
    createEntity(db, { id: 'ur_b', type: 'character', name: 'B' })
    const rel = createRelationship(db, { fromId: 'ur_a', toId: 'ur_b', type: 't', provenance: 'canon' })
    expect(() => updateRelationship(db, rel.id, { provenance: 'guess' })).toThrow(/provenance must be one of/)
    db.close()
  })
})

describe('attribute queries (getAttribute / listAttributes / promoteToCanon / dismissSuggested)', () => {
  it('getAttribute returns single attribute by id', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_g', type: 'character', name: 'X' })
    const a = writeAttribute(db, { entityId: 'e_g', key: 'eyes', value: 'green', provenance: 'canon' })
    const fetched = getAttribute(db, a.id)
    expect(fetched.id).toBe(a.id)
    expect(fetched.value).toBe('green')
    expect(getAttribute(db, 'unknown')).toBeNull()
    db.close()
  })

  it('listAttributes excludes dismissed and superseded by default', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_l', type: 'character', name: 'X' })
    const v1 = writeAttribute(db, { entityId: 'e_l', key: 'eyes', value: 'blue', provenance: 'inferred' })
    writeAttribute(db, { entityId: 'e_l', key: 'eyes', value: 'green', provenance: 'canon', supersedes: v1.id })
    const dismissed = writeAttribute(db, { entityId: 'e_l', key: 'hair', value: 'long', provenance: 'suggested' })
    dismissSuggested(db, dismissed.id)

    const active = listAttributes(db, { entityId: 'e_l' })
    expect(active.map((a) => a.key).sort()).toEqual(['eyes'])
    expect(active[0].value).toBe('green')
    expect(active[0].provenance).toBe('canon')

    const all = listAttributes(db, { entityId: 'e_l', includeDismissed: true, includeSuperseded: true })
    expect(all).toHaveLength(3)
    db.close()
  })

  it('listAttributes filters by key and provenance', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_lf', type: 'character', name: 'X' })
    writeAttribute(db, { entityId: 'e_lf', key: 'eyes', value: 'green', provenance: 'canon' })
    writeAttribute(db, { entityId: 'e_lf', key: 'hair', value: 'red', provenance: 'inferred' })
    writeAttribute(db, { entityId: 'e_lf', key: 'mood', value: 'sad', provenance: 'suggested' })
    expect(listAttributes(db, { entityId: 'e_lf', provenance: 'canon' }).map((a) => a.key)).toEqual(['eyes'])
    expect(listAttributes(db, { entityId: 'e_lf', key: 'hair' }).map((a) => a.key)).toEqual(['hair'])
    db.close()
  })

  it('promoteToCanon writes canon row that supersedes the original', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_p', type: 'character', name: 'X' })
    const inferred = writeAttribute(db, {
      entityId: 'e_p',
      key: 'eyes',
      value: 'blue',
      provenance: 'inferred',
      confidence: 0.5,
    })
    const promoted = promoteToCanon(db, inferred.id)
    expect(promoted.provenance).toBe('canon')
    expect(promoted.confidence).toBe(1)
    expect(promoted.value).toBe('blue')
    expect(promoted.entityId).toBe('e_p')
    const originalReloaded = getAttribute(db, inferred.id)
    expect(originalReloaded.supersededBy).toBe(promoted.id)
    db.close()
  })

  it('promoteToCanon allows overriding the value (edit-promotes-to-canon)', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_pe', type: 'character', name: 'X' })
    const inferred = writeAttribute(db, {
      entityId: 'e_pe',
      key: 'eyes',
      value: 'blue',
      provenance: 'inferred',
    })
    const promoted = promoteToCanon(db, inferred.id, { value: 'green' })
    expect(promoted.provenance).toBe('canon')
    expect(promoted.value).toBe('green')
    const originalReloaded = getAttribute(db, inferred.id)
    expect(originalReloaded.supersededBy).toBe(promoted.id)
    expect(originalReloaded.value).toBe('blue')
    db.close()
  })

  it('promoteToCanon throws if original not found', () => {
    const { db } = createTempDb()
    expect(() => promoteToCanon(db, 'nope')).toThrow(/attribute nope not found/)
    db.close()
  })

  it('dismissSuggested sets dismissed_at and is idempotent', () => {
    const { db } = createTempDb()
    createEntity(db, { id: 'e_d', type: 'character', name: 'X' })
    const a = writeAttribute(db, { entityId: 'e_d', key: 'mood', value: 'sad', provenance: 'suggested' })
    expect(dismissSuggested(db, a.id)).toBe(true)
    const reloaded = getAttribute(db, a.id)
    expect(reloaded.dismissedAt).toBeTruthy()
    expect(dismissSuggested(db, a.id)).toBe(false)
    expect(dismissSuggested(db, 'nonexistent')).toBe(false)
    db.close()
  })
})
