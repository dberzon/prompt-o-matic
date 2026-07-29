import { REWRITES, DEFAULTS } from '../data/constants.js'
import { resolveCharacterSlug } from './slugify.js'

function normalizeFragment(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(text = '') {
  return new Set(normalizeFragment(text).split(' ').filter(Boolean))
}

function isNearDuplicate(a, b) {
  const na = normalizeFragment(a)
  const nb = normalizeFragment(b)
  if (!na || !nb) return false
  if (na === nb) return true

  // Fast path for near-contained phrases (common in repeated qualifiers).
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  if (shorter.length >= 24 && longer.includes(shorter)) return true

  const ta = tokenSet(na)
  const tb = tokenSet(nb)
  if (ta.size === 0 || tb.size === 0) return false

  let intersection = 0
  for (const token of ta) {
    if (tb.has(token)) intersection += 1
  }
  const union = ta.size + tb.size - intersection
  const jaccard = union > 0 ? intersection / union : 0
  const smallerSize = Math.min(ta.size, tb.size)
  const largerSize = Math.max(ta.size, tb.size)
  const overlapToSmaller = intersection / Math.max(1, smallerSize)
  // Guard against short chips/defaults swallowing authored scenes.
  // Example: default shot "wide establishing shot" must not drop
  // "wide establishing shot of Ruslan alone on an empty railway platform…".
  const comparableCardinality = largerSize <= Math.max(smallerSize * 2, smallerSize + 3)
  return jaccard >= 0.9 || (comparableCardinality && overlapToSmaller >= 0.8)
}

export function dedupeFragments(parts = []) {
  const out = []
  for (const part of parts) {
    const value = typeof part === 'string' ? part.trim() : ''
    if (!value) continue
    if (out.some((existing) => isNearDuplicate(existing, value))) continue
    out.push(value)
  }
  return out
}

// Character Builder entries take priority over Actor Bank characters (same slug → CB wins).
function expandCharacterTokens(raw = '', characters = {}, actorBankSlugs = {}) {
  return String(raw).replace(/@([a-z0-9][a-z0-9_-]*)/gi, (full, rawSlug) => {
    const resolved = resolveCharacterSlug(String(rawSlug), characters)
    if (resolved) {
      const entry = characters[resolved]
      const value = (entry?.optimizedDescription || entry?.rawDescription || '').trim()
      return value || full
    }
    const normalized = String(rawSlug).toLowerCase()
    const alternate = normalized.includes('_') ? normalized.replace(/_/g, '-') : normalized.replace(/-/g, '_')
    const bankEntry = actorBankSlugs[normalized] || actorBankSlugs[alternate]
    const bankValue = (bankEntry?.promptDescriptor || '').trim()
    return bankValue || full
  })
}

export function rewriteScene(raw, characters = {}, actorBankSlugs = {}) {
  if (!raw.trim()) return ''
  let s = expandCharacterTokens(raw, characters, actorBankSlugs).trim().replace(/\.\s*$/, '')
  REWRITES.forEach(([pattern, replacement]) => {
    s = s.replace(pattern, replacement)
  })
  return s
}

export function assemblePrompt({ scene, scenario, chips, characters = {}, actorBankSlugs = {} }) {
  const rewritten = rewriteScene(scene, characters, actorBankSlugs)
  const hasMeat = scenario || rewritten
  const parts = []

  // 1. Shot + lens
  const shotVal = chips.shot?.[0] ?? (hasMeat ? DEFAULTS.shot : null)
  const lensVals = chips.lens ?? (hasMeat ? [DEFAULTS.lens] : [])
  if (shotVal) parts.push(shotVal)
  lensVals.forEach(v => parts.push(v))

  // 2. Interaction scenario (the subject)
  if (scenario) parts.push(scenario)

  // 3. Scene / environment description
  if (rewritten) parts.push(rewritten)

  // 4. Environment chips
  if (chips.env) chips.env.forEach(v => parts.push(v))
  if (chips.texture) chips.texture.forEach(v => parts.push(v))

  // 4b. Composition (frame placement — after environment, before light)
  if (chips.comp) chips.comp.forEach(v => parts.push(v))

  // 5. Light
  if (chips.light) {
    chips.light.forEach(v => parts.push(v))
  } else if (hasMeat) {
    parts.push(DEFAULTS.light)
  }

  // 6. Color / palette
  if (chips.color) {
    chips.color.forEach(v => parts.push(v))
  } else if (hasMeat) {
    parts.push(DEFAULTS.color)
  }

  // 7. Film stock
  if (chips.film) {
    chips.film.forEach(v => parts.push(v))
  } else if (hasMeat) {
    parts.push(DEFAULTS.film)
  }

  // 8. Qualifiers
  if (chips.qual) {
    chips.qual.forEach(v => parts.push(v))
  } else if (hasMeat) {
    parts.push(DEFAULTS.qual)
  }

  return dedupeFragments(parts)
}

export function getCharDesc(gender, age, promptDescriptor) {
  const MAP = {
    man: {
      child: 'boy',
      teen: 'teenage boy',
      '20s': 'young man in his mid-twenties',
      '30s': 'man in his early thirties',
      '40s': 'man in his mid-forties',
      '50s': 'man in his early fifties',
      '60s': 'man in his sixties',
      elderly: 'old man',
    },
    woman: {
      child: 'girl',
      teen: 'teenage girl',
      '20s': 'young woman in her mid-twenties',
      '30s': 'woman in her early thirties',
      '40s': 'woman in her mid-forties',
      '50s': 'woman in her early fifties',
      '60s': 'woman in her sixties',
      elderly: 'old woman',
    },
    person: {
      child: 'child',
      teen: 'teenager',
      '20s': 'person in their mid-twenties',
      '30s': 'person in their early thirties',
      '40s': 'person in their mid-forties',
      '50s': 'person in their early fifties',
      '60s': 'person in their sixties',
      elderly: 'elderly person',
    },
  }
  const base = MAP[gender]?.[age] ?? `${gender}, ${age}`
  const trimmed = typeof promptDescriptor === 'string' ? promptDescriptor.trim() : ''
  return trimmed ? `${base}, ${trimmed}` : base
}
