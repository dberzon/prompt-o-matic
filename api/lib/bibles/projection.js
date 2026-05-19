import { getEntity, listAttributes } from '../db/repositories.js'
import {
  CHARACTER_ENTITY_KEY_TO_BIBLE_PATH,
  ERA_ENTITY_KEY_TO_BIBLE_PATH,
  LOCATION_ENTITY_KEY_TO_BIBLE_PATH,
  PROP_ENTITY_KEY_TO_BIBLE_PATH,
  resolveBiblePath,
} from './attributePathMap.js'
import { CharacterBibleSchema } from './schemas/characterBible.schema.js'
import { EraBibleSchema } from './schemas/eraBible.schema.js'
import { LocationBibleSchema } from './schemas/locationBible.schema.js'
import { PropBibleSchema } from './schemas/propBible.schema.js'

/** @typedef {'canon' | 'inferred' | 'derived' | 'suggested' | 'temporary'} EntityAttributeProvenance */

const PROVENANCE_RANK = /** @type {Record<EntityAttributeProvenance, number>} */ ({
  canon: 0,
  inferred: 1,
  derived: 2,
  suggested: 3,
  temporary: 4,
})

export class EntityNotFoundError extends Error {
  /** @param {string} entityId */
  constructor(entityId) {
    super(`entity not found: ${entityId}`)
    this.name = 'EntityNotFoundError'
    this.entityId = entityId
  }
}

/**
 * @param {string} provenance
 * @returns {number}
 */
function provenanceRank(provenance) {
  return PROVENANCE_RANK[/** @type {EntityAttributeProvenance} */ (provenance)] ?? 99
}

/**
 * @param {{ provenance: string; createdAt?: string }} a
 * @param {{ provenance: string; createdAt?: string }} b
 * @returns {number}
 */
function compareAttributesForLeafWinner(a, b) {
  const dr = provenanceRank(a.provenance) - provenanceRank(b.provenance)
  if (dr !== 0) return dr
  return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
}

/**
 * @param {Array<{ provenance: string }>} attrs
 * @returns {EntityAttributeProvenance}
 */
function strongestProvenanceAmong(attrs) {
  let best = /** @type {EntityAttributeProvenance} */ ('temporary')
  let bestRank = 99
  for (const a of attrs) {
    const r = provenanceRank(a.provenance)
    if (r < bestRank) {
      bestRank = r
      best = /** @type {EntityAttributeProvenance} */ (a.provenance)
    }
  }
  return best
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {unknown}
 */
function coerceLeafValue(value, path) {
  if (path === 'visuals.continuityKeywords' && typeof value === 'string') {
    return value
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (path === 'wardrobe.accessories' && typeof value === 'string') {
    return value
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (path === 'visuals.moodKeywords' && typeof value === 'string') {
    return value
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (path === 'visuals.keywords' && typeof value === 'string') {
    return value
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return value
}

/**
 * @param {Array<{ value: unknown; provenance: string; createdAt?: string }>} group
 * @returns {string}
 */
function mergeWardrobeEverydayStrings(group) {
  const sorted = group.slice().sort(compareAttributesForLeafWinner)
  const parts = []
  const seen = new Set()
  for (const row of sorted) {
    const s = String(row.value ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    parts.push(s)
  }
  return parts.join('; ')
}

/**
 * @param {Record<string, unknown>} target
 * @param {string[]} parts
 * @param {unknown} value
 */
function setDeep(target, parts, value) {
  if (parts.length === 0) return
  const [head, ...rest] = parts
  if (!head) return
  if (rest.length === 0) {
    target[head] = value
    return
  }
  const next = rest[0]
  let child = target[head]
  if (child === undefined || child === null) {
    child = /^\d+$/.test(next) ? [] : {}
    target[head] = child
  }
  if (Array.isArray(child) && /^\d+$/.test(next)) {
    const idx = Number(next)
    while (child.length <= idx) child.push(undefined)
    if (rest.length === 1) {
      child[idx] = value
      return
    }
    if (child[idx] === undefined || child[idx] === null) {
      child[idx] = /^\d+$/.test(rest[1]) ? [] : {}
    }
    setDeep(/** @type {Record<string, unknown>} */ (child[idx]), rest.slice(1), value)
    return
  }
  if (typeof child === 'object') {
    setDeep(/** @type {Record<string, unknown>} */ (child), rest, value)
  }
}

/**
 * @param {Map<string, { value: unknown; provenance: string }>} leafMap
 * @returns {Record<string, unknown>}
 */
function leafMapToNestedObject(leafMap) {
  /** @type {Record<string, unknown>} */
  const root = {}
  for (const [path, { value }] of leafMap) {
    setDeep(root, path.split('.').filter(Boolean), value)
  }
  return root
}

/**
 * @param {Map<string, { value: unknown; provenance: string }>} leafMap
 * @returns {Record<string, EntityAttributeProvenance>}
 */
function leafMapToProvenance(rootMap) {
  /** @type {Record<string, EntityAttributeProvenance>} */
  const out = {}
  for (const [path, { provenance }] of rootMap) {
    out[path] = /** @type {EntityAttributeProvenance} */ (provenance)
  }
  return out
}

const CHARACTER_BIBLE_ROOTS = new Set(Object.keys(CharacterBibleSchema.shape))
const LOCATION_BIBLE_ROOTS = new Set(Object.keys(LocationBibleSchema.shape))
const ERA_BIBLE_ROOTS = new Set(Object.keys(EraBibleSchema.shape))
const PROP_BIBLE_ROOTS = new Set(Object.keys(PropBibleSchema.shape))

/**
 * @param {string} path
 * @param {Set<string>} allowedRoots
 * @returns {string | null}
 */
function biblePathOrNull(path, allowedRoots) {
  const root = path.includes('.') ? path.slice(0, path.indexOf('.')) : path
  if (!allowedRoots.has(root)) return null
  return path
}

/**
 * @param {Array<{ key: string; value: unknown; provenance: string; createdAt?: string }>} attrs
 * @param {(key: string) => string | null} resolveKey
 * @returns {Map<string, { value: unknown; provenance: string }>}
 */
function foldAttributes(attrs, resolveKey) {
  /** @type {Map<string, Array<{ key: string; value: unknown; provenance: string; createdAt?: string }>>} */
  const groups = new Map()
  for (const attr of attrs) {
    let path = resolveKey(attr.key)
    if (!path) continue
    if (path.startsWith('wardrobe.') && path !== 'wardrobe.everyday' && path !== 'wardrobe.accessories') {
      path = 'wardrobe.everyday'
    }
    if (!groups.has(path)) groups.set(path, [])
    groups.get(path).push(attr)
  }

  /** @type {Map<string, { value: unknown; provenance: string }>} */
  const winners = new Map()
  for (const [path, group] of groups) {
    if (group.length === 0) continue
    const sorted = group.slice().sort(compareAttributesForLeafWinner)
    if (path === 'wardrobe.everyday' && group.length > 1) {
      winners.set(path, {
        value: mergeWardrobeEverydayStrings(group),
        provenance: strongestProvenanceAmong(group),
      })
      continue
    }
    const best = sorted[0]
    winners.set(path, {
      value: coerceLeafValue(best.value, path),
      provenance: best.provenance,
    })
  }
  return winners
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {NonNullable<ReturnType<typeof getEntity>>}
 */
function requireEntity(db, entityId) {
  const entity = getEntity(db, entityId)
  if (!entity) throw new EntityNotFoundError(entityId)
  return entity
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {import('zod').infer<typeof CharacterBibleSchema> & { _provenance: Record<string, EntityAttributeProvenance> }}
 */
function buildCharacterBibleLeafMap(db, entityId) {
  requireEntity(db, entityId)
  const attrs = listAttributes(db, { entityId })
  const resolveKey = (key) => {
    const path = resolveBiblePath(CHARACTER_ENTITY_KEY_TO_BIBLE_PATH, key)
    return biblePathOrNull(path, CHARACTER_BIBLE_ROOTS)
  }
  return foldAttributes(attrs, resolveKey)
}

export function projectCharacterBible(db, entityId) {
  const leafMap = buildCharacterBibleLeafMap(db, entityId)
  const nested = leafMapToNestedObject(leafMap)
  const parsed = CharacterBibleSchema.parse(nested)
  return { ...parsed, _provenance: leafMapToProvenance(leafMap) }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {import('zod').infer<typeof LocationBibleSchema> & { _provenance: Record<string, EntityAttributeProvenance> }}
 */
function buildLocationBibleLeafMap(db, entityId) {
  const entity = requireEntity(db, entityId)
  const attrs = listAttributes(db, { entityId })
  const resolveKey = (key) => {
    const path = resolveBiblePath(LOCATION_ENTITY_KEY_TO_BIBLE_PATH, key)
    return biblePathOrNull(path, LOCATION_BIBLE_ROOTS)
  }
  const leafMap = foldAttributes(attrs, resolveKey)
  if (!leafMap.has('identity.name') && entity.name) {
    leafMap.set('identity.name', { value: entity.name, provenance: 'canon' })
  }
  return leafMap
}

export function projectLocationBible(db, entityId) {
  const leafMap = buildLocationBibleLeafMap(db, entityId)
  const nested = leafMapToNestedObject(leafMap)
  const parsed = LocationBibleSchema.parse(nested)
  return { ...parsed, _provenance: leafMapToProvenance(leafMap) }
}

function buildEraBibleLeafMap(db, entityId) {
  const entity = requireEntity(db, entityId)
  const attrs = listAttributes(db, { entityId })
  const resolveKey = (key) => {
    const path = resolveBiblePath(ERA_ENTITY_KEY_TO_BIBLE_PATH, key)
    return biblePathOrNull(path, ERA_BIBLE_ROOTS)
  }
  const leafMap = foldAttributes(attrs, resolveKey)
  if (!leafMap.has('identity.label') && entity.name) {
    leafMap.set('identity.label', { value: entity.name, provenance: 'canon' })
  }
  return leafMap
}

export function projectEraBible(db, entityId) {
  const leafMap = buildEraBibleLeafMap(db, entityId)
  const nested = leafMapToNestedObject(leafMap)
  const parsed = EraBibleSchema.parse(nested)
  return { ...parsed, _provenance: leafMapToProvenance(leafMap) }
}

function buildPropBibleLeafMap(db, entityId) {
  const entity = requireEntity(db, entityId)
  const attrs = listAttributes(db, { entityId })
  const resolveKey = (key) => {
    const path = resolveBiblePath(PROP_ENTITY_KEY_TO_BIBLE_PATH, key)
    return biblePathOrNull(path, PROP_BIBLE_ROOTS)
  }
  const leafMap = foldAttributes(attrs, resolveKey)
  if (!leafMap.has('identity.label') && entity.name) {
    leafMap.set('identity.label', { value: entity.name, provenance: 'canon' })
  }
  return leafMap
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {import('zod').infer<typeof PropBibleSchema> & { _provenance: Record<string, EntityAttributeProvenance> }}
 */
export function projectPropBible(db, entityId) {
  const leafMap = buildPropBibleLeafMap(db, entityId)
  const nested = leafMapToNestedObject(leafMap)
  const parsed = PropBibleSchema.parse(nested)
  return { ...parsed, _provenance: leafMapToProvenance(leafMap) }
}

const PARTIAL_CHARACTER_BIBLE_SKELETON = {
  demographics: {},
  physical: {},
  relationships: [],
  visuals: {},
}

const PARTIAL_LOCATION_BIBLE_SKELETON = {
  identity: {},
  geography: {},
  function: {},
  visuals: {},
  inhabitants: [],
}

const PARTIAL_ERA_BIBLE_SKELETON = {
  identity: {},
  timeframe: {},
}

const PARTIAL_PROP_BIBLE_SKELETON = {
  identity: {},
  function: {},
  visuals: {},
}

/**
 * @param {Map<string, { value: unknown; provenance: string }>} leafMap
 * @param {import('zod').ZodTypeAny} schema
 * @param {Record<string, unknown>} skeleton
 * @returns {Record<string, unknown> & { _provenance: Record<string, EntityAttributeProvenance> }}
 */
function projectLeafMapForApi(leafMap, schema, skeleton) {
  const nested = leafMapToNestedObject(leafMap)
  const parsed = schema.safeParse(nested)
  const bible = parsed.success ? parsed.data : { ...skeleton, ...nested }
  return { ...bible, _provenance: leafMapToProvenance(leafMap) }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns
 *   | ReturnType<typeof projectCharacterBible>
 *   | ReturnType<typeof projectLocationBible>
 *   | ReturnType<typeof projectEraBible>
 *   | ReturnType<typeof projectPropBible>
 */
export function projectBible(db, entityId) {
  const entity = requireEntity(db, entityId)
  switch (entity.type) {
    case 'character':
    case 'environment':
    case 'institution':
      return projectCharacterBible(db, entityId)
    case 'location':
      return projectLocationBible(db, entityId)
    case 'era':
      return projectEraBible(db, entityId)
    case 'prop':
      return projectPropBible(db, entityId)
    default:
      throw new Error(`projectBible: unsupported entity type: ${entity.type}`)
  }
}

/**
 * Attribute-derived Bible object for read/export/snapshot API paths.
 *
 * This preserves the strict parsed shape when enough data exists, but incomplete
 * entities are still valid work-in-progress records and must remain readable.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {Record<string, unknown> & { _provenance: Record<string, EntityAttributeProvenance> }}
 */
export function projectBibleForApi(db, entityId) {
  const entity = requireEntity(db, entityId)
  switch (entity.type) {
    case 'character':
    case 'environment':
    case 'institution':
      return projectLeafMapForApi(
        buildCharacterBibleLeafMap(db, entityId),
        CharacterBibleSchema,
        PARTIAL_CHARACTER_BIBLE_SKELETON,
      )
    case 'location':
      return projectLeafMapForApi(
        buildLocationBibleLeafMap(db, entityId),
        LocationBibleSchema,
        PARTIAL_LOCATION_BIBLE_SKELETON,
      )
    case 'era':
      return projectLeafMapForApi(buildEraBibleLeafMap(db, entityId), EraBibleSchema, PARTIAL_ERA_BIBLE_SKELETON)
    case 'prop':
      return projectLeafMapForApi(buildPropBibleLeafMap(db, entityId), PropBibleSchema, PARTIAL_PROP_BIBLE_SKELETON)
    default:
      throw new Error(`projectBible: unsupported entity type: ${entity.type}`)
  }
}

/**
 * Attribute-derived nested Bible object **before** Zod parse (used for completeness when parse would fail).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {Record<string, unknown>}
 */
export function projectBibleNested(db, entityId) {
  const entity = requireEntity(db, entityId)
  switch (entity.type) {
    case 'character':
    case 'environment':
    case 'institution':
      return leafMapToNestedObject(buildCharacterBibleLeafMap(db, entityId))
    case 'location':
      return leafMapToNestedObject(buildLocationBibleLeafMap(db, entityId))
    case 'era':
      return leafMapToNestedObject(buildEraBibleLeafMap(db, entityId))
    case 'prop':
      return leafMapToNestedObject(buildPropBibleLeafMap(db, entityId))
    default:
      throw new Error(`projectBible: unsupported entity type: ${entity.type}`)
  }
}
