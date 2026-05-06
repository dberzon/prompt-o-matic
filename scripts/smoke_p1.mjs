// Smoke test for Phase 1 schema, slug generation, and backfill.
// Uses an in-memory SQLite DB so it does not touch real data.

import Database from 'better-sqlite3'
import { initializeDatabase, runDataBackfills } from '../api/lib/db/sqlite.js'
import { randomUUID } from 'node:crypto'
import { createCharacter, getCharacter } from '../api/lib/db/repositories.js'
import { setCharacterPromptDescriptor } from '../api/lib/characters/promptDescriptor.js'

const db = new Database(':memory:')
initializeDatabase(db)

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  PASS:', msg)
}

console.log('1. Schema migrations include slug + prompt_descriptor:')
const cols = db.prepare("PRAGMA table_info(characters)").all().map((c) => c.name)
assert(cols.includes('slug'), 'characters.slug column exists')
assert(cols.includes('prompt_descriptor'), 'characters.prompt_descriptor column exists')

const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_characters_slug'").get()
assert(!!idx, 'idx_characters_slug unique index exists')

console.log('\n2. Auto slug generation in createCharacter:')
const baseProfile = {
  age: 27,
  apparentAgeRange: { min: 25, max: 30 },
  faceShape: 'oval',
  eyes: 'gray-green',
  eyebrows: 'thin',
  nose: 'straight',
  lips: 'thin',
  jawline: 'soft',
  skinTone: 'fair',
  hairColor: 'dark brown',
  hairLength: 'shoulder-length',
  hairTexture: 'straight',
  hairstyle: 'pulled back',
  bodyType: 'slight',
  heightImpression: 'average',
  posture: 'upright',
  distinctiveFeatures: ['high cheekbones'],
  wardrobeBase: 'gray wool coat',
  cinematicArchetype: 'observer',
  personalityEnergy: 'reserved',
  visualKeywords: ['eastern european'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const c1 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Lena Sholk' })
assert(c1.slug === 'lena_sholk', `c1.slug = ${c1.slug}`)
assert(c1.promptDescriptor == null, 'c1.promptDescriptor is null at creation')

const c2 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Lena Sholk' })
assert(c2.slug === 'lena_sholk_2', `collision suffix: c2.slug = ${c2.slug}`)

const c3 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Lena Sholk' })
assert(c3.slug === 'lena_sholk_3', `c3.slug = ${c3.slug}`)

console.log('\n3. setCharacterPromptDescriptor:')
const updated = setCharacterPromptDescriptor(db, c1.id, '  young woman, sharp eastern european features, dark pulled-back hair, gray-green eyes, slight frame, gray wool coat  ')
assert(updated.promptDescriptor === 'young woman, sharp eastern european features, dark pulled-back hair, gray-green eyes, slight frame, gray wool coat', 'descriptor trimmed and saved')

const stored = getCharacter(db, c1.id)
assert(stored.promptDescriptor === updated.promptDescriptor, 'descriptor persists in payload_json')
const dbRow = db.prepare('SELECT prompt_descriptor FROM characters WHERE id = ?').get(c1.id)
assert(dbRow.prompt_descriptor === updated.promptDescriptor, 'descriptor persists in column')

console.log('\n4. Backfill idempotency:')
// Insert a character WITHOUT slug to simulate pre-migration data.
db.prepare(`
  INSERT INTO characters (id, project_id, embedding_status, lifecycle_status, name, age, gender_presentation, cinematic_archetype, slug, prompt_descriptor, payload_json, created_at, updated_at)
  VALUES (@id, @project_id, @embedding_status, @lifecycle_status, @name, @age, @gender_presentation, @cinematic_archetype, NULL, NULL, @payload_json, @created_at, @updated_at)
`).run({
  id: 'test-id-backfill',
  project_id: null,
  embedding_status: 'not_indexed',
  lifecycle_status: 'auditioned',
  name: 'Viktor Morel',
  age: 44,
  gender_presentation: null,
  cinematic_archetype: 'observer',
  payload_json: JSON.stringify({ id: 'test-id-backfill', name: 'Viktor Morel', ...baseProfile, age: 44 }),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

runDataBackfills(db)
const backfilled = db.prepare('SELECT slug FROM characters WHERE id = ?').get('test-id-backfill')
assert(backfilled.slug === 'viktor_morel', `backfilled slug = ${backfilled.slug}`)

const before = db.prepare('SELECT COUNT(*) as n FROM characters WHERE slug IS NULL').get().n
runDataBackfills(db)
const after = db.prepare('SELECT COUNT(*) as n FROM characters WHERE slug IS NULL').get().n
assert(before === 0 && after === 0, 'backfill is idempotent (no slug-NULL rows after second run)')

console.log('\n5. Backfill collision handling:')
// Insert another character with the same name to force collision.
db.prepare(`
  INSERT INTO characters (id, project_id, embedding_status, lifecycle_status, name, age, gender_presentation, cinematic_archetype, slug, prompt_descriptor, payload_json, created_at, updated_at)
  VALUES (@id, @project_id, @embedding_status, @lifecycle_status, @name, @age, @gender_presentation, @cinematic_archetype, NULL, NULL, @payload_json, @created_at, @updated_at)
`).run({
  id: 'test-id-backfill-2',
  project_id: null,
  embedding_status: 'not_indexed',
  lifecycle_status: 'auditioned',
  name: 'Viktor Morel',
  age: 44,
  gender_presentation: null,
  cinematic_archetype: 'observer',
  payload_json: JSON.stringify({ id: 'test-id-backfill-2', name: 'Viktor Morel', ...baseProfile, age: 44 }),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})
runDataBackfills(db)
const collidedBackfill = db.prepare('SELECT slug FROM characters WHERE id = ?').get('test-id-backfill-2')
assert(collidedBackfill.slug === 'viktor_morel_2', `collision-aware backfill: slug = ${collidedBackfill.slug}`)

console.log('\nALL SMOKE CHECKS PASSED ✓')
db.close()
