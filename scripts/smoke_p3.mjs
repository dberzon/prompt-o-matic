// Smoke test for Phase 3: actorBankSlugs expansion, priority, deduplication.

import { rewriteScene, assemblePrompt } from '../src/utils/assembler.js'

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('  PASS:', msg)
}

console.log('1. @slug expands via actorBankSlugs when not in characters:')
const actorBankSlugs = {
  lena_sholk: { promptDescriptor: 'sharp eastern european features, dark pulled-back hair' },
  viktor_morel: { promptDescriptor: 'heavy-set, late forties, stern gaze' },
  no_desc: { promptDescriptor: null },
}

const r1 = rewriteScene('@lena_sholk reads at the window', {}, actorBankSlugs)
assert(r1.includes('sharp eastern european features'), `bank expansion: "${r1}"`)

const r2 = rewriteScene('@viktor_morel enters the room', {}, actorBankSlugs)
assert(r2.includes('heavy-set'), `bank expansion viktor: "${r2}"`)

console.log('\n2. Character Builder entry takes priority over Actor Bank:')
const cbChars = { lena_sholk: { optimizedDescription: 'CB version of Lena' } }
const r3 = rewriteScene('@lena_sholk at the table', cbChars, actorBankSlugs)
assert(r3.includes('CB version of Lena'), `CB priority: "${r3}"`)
assert(!r3.includes('sharp eastern'), `bank version excluded: "${r3}"`)

console.log('\n3. Unknown @slug left unexpanded:')
const r4 = rewriteScene('@unknown_person sits', {}, actorBankSlugs)
assert(r4.includes('@unknown_person'), `unknown slug intact: "${r4}"`)

console.log('\n4. Bank char with null descriptor leaves @slug unexpanded:')
const r5 = rewriteScene('@no_desc sits', {}, actorBankSlugs)
assert(r5.includes('@no_desc'), `null descriptor: "${r5}"`)

console.log('\n5. Kebab-to-snake compatibility:')
const r6 = rewriteScene('@lena-sholk reads', {}, actorBankSlugs)
assert(r6.includes('sharp eastern european features'), `kebab slug resolves: "${r6}"`)

console.log('\n6. assemblePrompt passes actorBankSlugs to rewriteScene:')
const parts = assemblePrompt({
  scene: '@lena_sholk by the window',
  scenario: '',
  chips: {},
  characters: {},
  actorBankSlugs,
})
assert(parts.some(p => p.includes('sharp eastern european features')), `assemblePrompt expansion: ${JSON.stringify(parts)}`)

console.log('\n7. assemblePrompt with empty actorBankSlugs defaults:')
const parts2 = assemblePrompt({ scene: 'foggy street', scenario: '', chips: {} })
assert(Array.isArray(parts2) && parts2.length > 0, 'empty call returns array')

console.log('\n8. Deduplication still works after expansion:')
const parts3 = assemblePrompt({
  scene: '@lena_sholk by the window',
  scenario: '',
  chips: { light: ['sharp eastern european features'] },
  characters: {},
  actorBankSlugs,
})
const joined = parts3.join(', ')
const matches = (joined.match(/sharp eastern european features/g) || []).length
assert(matches === 1, `deduped to 1 occurrence: "${joined}"`)

console.log('\nALL P3 SMOKE CHECKS PASSED ✓')
