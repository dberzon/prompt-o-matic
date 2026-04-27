/**
 * Scene matcher: local keyword + fuzzy search across the full library.
 *
 * Sources:
 *  - DIRECTORS (name, short, note, scenarios for 1/2/3 characters)
 *  - SCENE_BANK (styleKey, compact, seeds2)
 *  - DECK_CATEGORIES (all 15 card categories)
 *
 * No network; index is built once at module load.
 */

import { DIRECTORS } from '../data/directors.js'
import { SCENE_BANK } from '../data/sceneBank.js'
import {
  DECK_CATEGORIES,
  CAMERA_TO_SHOT,
  LIGHTING_TO_CHIP,
  COLOR_TO_CHIP,
  LOCATION_TO_ENV,
} from '../data/sceneDeck.js'

// ── Tokenization ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'so', 'yet', 'of', 'at', 'by',
  'for', 'from', 'in', 'into', 'on', 'onto', 'over', 'to', 'up', 'with', 'without',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'it', 'its', 'this', 'that', 'these', 'those', 'they', 'them', 'their',
  'he', 'she', 'him', 'her', 'his', 'hers',
  'we', 'us', 'our', 'you', 'your',
  'as', 'if', 'then', 'than',
  'one', 'two', 'three', 'both', 'each', 'other', 'another', 'same',
  'who', 'what', 'which', 'while', 'when', 'where', 'how',
  'about', 'between', 'through',
  'not', 'no',
  'person', 'people', 'character', 'characters', 'figure', 'figures',
  'scene', 'shot', 'camera', 'frame',
  'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must',
  'c0', 'c1', 'c2',
])

function tokenize(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .toLowerCase()
    .replace(/\$\{[^}]+\}/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

/** Levenshtein ≤ 1 check (insertion, deletion, substitution). */
function withinEdit1(a, b) {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  // substitution (equal length)
  if (la === lb) {
    let diffs = 0
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i]) {
        diffs++
        if (diffs > 1) return false
      }
    }
    return diffs <= 1
  }
  // insertion / deletion
  const shorter = la < lb ? a : b
  const longer = la < lb ? b : a
  let i = 0
  let j = 0
  let edits = 0
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++
      j++
    } else {
      j++
      edits++
      if (edits > 1) return false
    }
  }
  return true
}

// ── Corpus build ─────────────────────────────────────────────────────────────

/** Flatten scenarios for 1, 2, 3 characters into a single text blob. */
function flattenScenarios(entry) {
  const dummyChars = ['a person', 'another person', 'a third person']
  const parts = []
  for (const count of [1, 2, 3]) {
    const fn = entry?.s?.[count]
    if (typeof fn !== 'function') continue
    try {
      const arr = fn(dummyChars)
      if (Array.isArray(arr)) parts.push(...arr)
    } catch {
      /* ignore scenario build errors */
    }
  }
  return parts.join(' ')
}

/** Build the corpus of entries (done once at module load). */
function buildCorpus() {
  const entries = []

  // 1) Directors
  for (const [dirKey, d] of Object.entries(DIRECTORS)) {
    const bank = SCENE_BANK[dirKey]
    const scenarioText = flattenScenarios(d)
    const text = [
      d.name,
      d.short,
      d.note,
      scenarioText,
      bank?.styleKey ?? '',
      bank?.compact ?? '',
    ].join(' ')
    entries.push({
      id: `dir:${dirKey}`,
      type: 'director',
      dirKey,
      previewText: d.note ?? '',
      text,
      tokens: tokenize(text),
      // small prior so one-word director-name queries win
      prior: 0.12,
    })
  }

  // 2) Scene bank seeds (seeds2 + compact styleKey summary)
  for (const [dirKey, bank] of Object.entries(SCENE_BANK)) {
    const seeds = Array.isArray(bank?.seeds2) ? bank.seeds2 : []
    seeds.forEach((seed, i) => {
      const text = [
        seed,
        bank?.styleKey ?? '',
        bank?.compact ?? '',
      ].join(' ')
      entries.push({
        id: `seed:${dirKey}:${i}`,
        type: 'seed',
        dirKey,
        seedText: seed,
        styleKey: bank?.styleKey ?? null,
        previewText: seed,
        text,
        tokens: tokenize(text),
        prior: 0.06,
      })
    })
  }

  // 3) Deck cards (all categories)
  for (const [categoryId, cat] of Object.entries(DECK_CATEGORIES)) {
    cat.cards.forEach((card, i) => {
      let chipPatch = null
      if (categoryId === 'camera' && CAMERA_TO_SHOT[card]) {
        chipPatch = { shot: [CAMERA_TO_SHOT[card]] }
      } else if (categoryId === 'lighting' && LIGHTING_TO_CHIP[card]) {
        chipPatch = { light: [LIGHTING_TO_CHIP[card]] }
      } else if (categoryId === 'color' && COLOR_TO_CHIP[card]) {
        chipPatch = { color: [COLOR_TO_CHIP[card]] }
      } else if (categoryId === 'location' && LOCATION_TO_ENV[card]) {
        chipPatch = { env: [LOCATION_TO_ENV[card]] }
      }
      entries.push({
        id: `card:${categoryId}:${i}`,
        type: 'card',
        categoryId,
        categoryLabel: cat.label,
        cardIndex: i,
        cardText: card,
        previewText: card,
        chipPatch,
        text: `${cat.label} ${card}`,
        tokens: tokenize(`${cat.label} ${card}`),
        prior: 0,
      })
    })
  }

  return entries
}

/** Compute IDF for every token across the corpus. */
function computeIdf(entries) {
  const df = new Map()
  for (const entry of entries) {
    const seen = new Set()
    for (const t of entry.tokens) {
      if (seen.has(t)) continue
      seen.add(t)
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
  const N = entries.length
  const idf = new Map()
  for (const [t, dfVal] of df.entries()) {
    idf.set(t, Math.log(1 + N / (1 + dfVal)))
  }
  return idf
}

const CORPUS = buildCorpus()
const IDF = computeIdf(CORPUS)

// Index: token → array of entry indices (speeds up scoring with fuzzy fallback).
const TOKEN_INDEX = (() => {
  const map = new Map()
  CORPUS.forEach((entry, idx) => {
    const seen = new Set()
    for (const t of entry.tokens) {
      if (seen.has(t)) continue
      seen.add(t)
      if (!map.has(t)) map.set(t, [])
      map.get(t).push(idx)
    }
  })
  return map
})()

const ALL_TOKENS = Array.from(TOKEN_INDEX.keys())

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * For each query token, return the set of corpus tokens that match it:
 *  - exact match (weight 1)
 *  - or edit-distance ≤ 1 for tokens of length ≥ 4 (weight 0.6)
 */
function expandQueryToken(qt) {
  const matches = new Map()
  if (TOKEN_INDEX.has(qt)) matches.set(qt, 1)
  if (qt.length >= 4) {
    for (const t of ALL_TOKENS) {
      if (matches.has(t)) continue
      if (withinEdit1(qt, t)) matches.set(t, 0.6)
    }
  }
  // prefix / contains fallback for longer tokens (e.g. "neon" matches "neonlit" none, but "tarkov" → "tarkovsky")
  if (qt.length >= 5) {
    for (const t of ALL_TOKENS) {
      if (matches.has(t)) continue
      if (t.startsWith(qt) || qt.startsWith(t)) matches.set(t, 0.75)
    }
  }
  return matches
}

function scoreEntry(entry, queryTokens, expandedPerQueryToken, queryLower) {
  let score = 0
  let matchedTokens = 0
  const hits = new Set()

  for (let qi = 0; qi < queryTokens.length; qi++) {
    const expansions = expandedPerQueryToken[qi]
    let best = 0
    for (const t of entry.tokens) {
      const w = expansions.get(t)
      if (w === undefined) continue
      const idfWeight = IDF.get(t) ?? 1
      const contribution = w * idfWeight
      if (contribution > best) best = contribution
      hits.add(t)
    }
    if (best > 0) {
      score += best
      matchedTokens++
    }
  }

  if (matchedTokens === 0) return null

  // Coverage bonus: reward entries that hit more of the user's query tokens
  const coverage = matchedTokens / Math.max(1, queryTokens.length)
  score *= 0.6 + 0.6 * coverage

  // Exact substring bonus on previewText or text
  if (queryLower && queryLower.length >= 3) {
    if (entry.previewText && entry.previewText.toLowerCase().includes(queryLower)) {
      score += 1.5
    } else if (entry.text.toLowerCase().includes(queryLower)) {
      score += 0.6
    }
  }

  score += entry.prior ?? 0

  return { score, matchedTokens: Array.from(hits) }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Search the full corpus.
 * @param {string} query
 * @param {object} opts { limitDirectors, limitSeeds, limitCards }
 * @returns {{ directors:[], seeds:[], cards:[], total:number }}
 */
export function searchCorpus(query, opts = {}) {
  const {
    limitDirectors = 5,
    limitSeeds = 5,
    limitCards = 12,
  } = opts

  const empty = { directors: [], seeds: [], cards: [], total: 0 }
  if (!query || typeof query !== 'string') return empty
  const trimmed = query.trim()
  if (trimmed.length === 0) return empty

  const queryTokens = tokenize(trimmed)
  if (queryTokens.length === 0) return empty

  const expandedPerQueryToken = queryTokens.map(expandQueryToken)

  // Candidate set: union of all entries that have at least one matching expanded token
  const candidates = new Set()
  for (const expansions of expandedPerQueryToken) {
    for (const t of expansions.keys()) {
      const indices = TOKEN_INDEX.get(t)
      if (!indices) continue
      for (const idx of indices) candidates.add(idx)
    }
  }

  const queryLower = trimmed.toLowerCase()
  const scored = []
  for (const idx of candidates) {
    const entry = CORPUS[idx]
    const result = scoreEntry(entry, queryTokens, expandedPerQueryToken, queryLower)
    if (!result) continue
    scored.push({ entry, ...result })
  }

  scored.sort((a, b) => b.score - a.score)

  const directors = []
  const seeds = []
  const cards = []
  for (const s of scored) {
    const { entry, score, matchedTokens } = s
    if (entry.type === 'director' && directors.length < limitDirectors) {
      directors.push({
        type: 'director',
        dirKey: entry.dirKey,
        score,
        matchedTokens,
        previewText: entry.previewText,
      })
    } else if (entry.type === 'seed' && seeds.length < limitSeeds) {
      seeds.push({
        type: 'seed',
        dirKey: entry.dirKey,
        seedText: entry.seedText,
        styleKey: entry.styleKey,
        score,
        matchedTokens,
        previewText: entry.previewText,
      })
    } else if (entry.type === 'card' && cards.length < limitCards) {
      cards.push({
        type: 'card',
        categoryId: entry.categoryId,
        categoryLabel: entry.categoryLabel,
        cardIndex: entry.cardIndex,
        cardText: entry.cardText,
        chipPatch: entry.chipPatch,
        score,
        matchedTokens,
        previewText: entry.previewText,
      })
    }
    if (
      directors.length >= limitDirectors &&
      seeds.length >= limitSeeds &&
      cards.length >= limitCards
    ) {
      break
    }
  }

  return {
    directors,
    seeds,
    cards,
    total: directors.length + seeds.length + cards.length,
  }
}

/** Exposed for debugging / tests. */
export function _debugCorpusSize() {
  return CORPUS.length
}
