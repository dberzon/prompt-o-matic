// Smoke test for Phase 2: lookup endpoint, mapping helpers, getCharDesc with descriptor.

import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { initializeDatabase } from '../api/lib/db/sqlite.js'
import { createCharacter, listCharacterSlugs } from '../api/lib/db/repositories.js'
import { ageToBracket, genderPresentationToG } from '../src/utils/actorBankMapping.js'
import { getCharDesc } from '../src/utils/assembler.js'

const db = new Database(':memory:')
initializeDatabase(db)

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('  PASS:', msg)
}

const baseProfile = {
  age: 27,
  apparentAgeRange: { min: 25, max: 30 },
  faceShape: 'oval', eyes: 'gray-green', eyebrows: 'thin', nose: 'straight', lips: 'thin',
  jawline: 'soft', skinTone: 'fair', hairColor: 'dark brown', hairLength: 'shoulder-length',
  hairTexture: 'straight', hairstyle: 'pulled back', bodyType: 'slight', heightImpression: 'average',
  posture: 'upright', distinctiveFeatures: ['high cheekbones'], wardrobeBase: 'gray wool coat',
  cinematicArchetype: 'observer', personalityEnergy: 'reserved', visualKeywords: ['eastern european'],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

console.log('1. listCharacterSlugs response shape:')
const c1 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Lena Sholk', genderPresentation: 'female', age: 27, promptDescriptor: 'sharp eastern european features, dark pulled-back hair' })
const c2 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Viktor Morel', genderPresentation: 'male', age: 44 })
const c3 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Preview Char', lifecycleStatus: 'preview', age: 35 })

const items = listCharacterSlugs(db)
assert(items.length === 2, `2 items returned (preview filtered out): got ${items.length}`)
const lena = items.find(i => i.name === 'Lena Sholk')
assert(lena.slug === 'lena_sholk', `Lena slug = ${lena.slug}`)
assert(lena.promptDescriptor === 'sharp eastern european features, dark pulled-back hair', 'Lena descriptor returned')
assert(lena.genderPresentation === 'female', 'Lena gender returned')
assert(lena.age === 27, 'Lena age returned')
assert(lena.thumbnailUrl === null, 'Lena thumbnail null when no images')
const viktor = items.find(i => i.name === 'Viktor Morel')
assert(viktor.promptDescriptor === null, 'Viktor descriptor null when not set')

console.log('\n2. Gender/age mapping:')
assert(genderPresentationToG('female') === 'woman', 'female → woman')
assert(genderPresentationToG('Male') === 'man', 'Male → man')
assert(genderPresentationToG('non-binary') === 'person', 'non-binary → person')
assert(genderPresentationToG('') === 'person', 'empty → person')
assert(genderPresentationToG(null) === 'person', 'null → person')
assert(ageToBracket(27) === '20s', 'age 27 → 20s')
assert(ageToBracket(44) === '40s', 'age 44 → 40s')
assert(ageToBracket(8) === 'child', 'age 8 → child')
assert(ageToBracket(15) === 'teen', 'age 15 → teen')
assert(ageToBracket(75) === 'elderly', 'age 75 → elderly')
assert(ageToBracket(null) === '30s', 'null age → 30s default')

console.log('\n3. getCharDesc with descriptor:')
const baseOnly = getCharDesc('woman', '20s')
assert(baseOnly === 'young woman in her mid-twenties', `base only: "${baseOnly}"`)
const withDesc = getCharDesc('woman', '20s', 'sharp eastern european features')
assert(withDesc === 'young woman in her mid-twenties, sharp eastern european features', `with descriptor: "${withDesc}"`)
const emptyDesc = getCharDesc('woman', '20s', '   ')
assert(emptyDesc === baseOnly, 'whitespace-only descriptor ignored')
const nullDesc = getCharDesc('woman', '20s', null)
assert(nullDesc === baseOnly, 'null descriptor ignored')

console.log('\n4. listCharacterSlugs filters archived characters:')
const c4 = createCharacter(db, { ...baseProfile, id: randomUUID(), name: 'Archived Char', age: 30 })
db.prepare('UPDATE characters SET archived_at = ? WHERE id = ?').run(new Date().toISOString(), c4.id)
const itemsAfterArchive = listCharacterSlugs(db)
assert(!itemsAfterArchive.some(i => i.name === 'Archived Char'), 'archived character not in list')

console.log('\nALL P2 SMOKE CHECKS PASSED ✓')
db.close()
