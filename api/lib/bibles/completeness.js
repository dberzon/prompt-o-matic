import { z } from 'zod'
import { getEntity } from '../db/repositories.js'
import { EntityNotFoundError, projectBibleNested } from './projection.js'
import { readSectionRequirement } from './schemas/_sectionMarkers.js'
import { CharacterBibleSchema } from './schemas/characterBible.schema.js'
import { EraBibleSchema } from './schemas/eraBible.schema.js'
import { LocationBibleSchema } from './schemas/locationBible.schema.js'
import { PropBibleSchema } from './schemas/propBible.schema.js'

/**
 * @typedef {{ section: string, field: string }} BibleFieldRef
 */

/**
 * @typedef {{
 *   ratio: number
 *   requiredCount: number
 *   recommendedCount: number
 *   presentRequired: number
 *   presentRecommended: number
 *   missingRequired: BibleFieldRef[]
 *   missingRecommended: BibleFieldRef[]
 * }} CompletenessReport
 */

/**
 * @param {string} entityType
 * @returns {import('zod').ZodObject<any>}
 */
function bibleRootSchema(entityType) {
  switch (entityType) {
    case 'character':
    case 'environment':
    case 'institution':
      return CharacterBibleSchema
    case 'location':
      return LocationBibleSchema
    case 'era':
      return EraBibleSchema
    case 'prop':
      return PropBibleSchema
    default:
      throw new Error(`getBibleCompleteness: unsupported entity type: ${entityType}`)
  }
}

/**
 * @param {import('zod').ZodTypeAny} s
 * @returns {boolean}
 */
function hasDefaultEmptyArray(s) {
  let cur = s
  while (cur instanceof z.ZodOptional) {
    cur = cur.unwrap()
  }
  if (cur instanceof z.ZodDefault) {
    const dv = cur.def?.defaultValue
    return Array.isArray(dv) && dv.length === 0
  }
  return false
}

/**
 * @param {import('zod').ZodTypeAny} sectionRootSchema
 * @returns {'required' | 'recommended'}
 */
function tierForTopLevelSection(sectionRootSchema) {
  const req = readSectionRequirement(sectionRootSchema)
  if (req === 'required' || req === 'recommended') {
    return req
  }
  if (sectionRootSchema instanceof z.ZodOptional) {
    return 'recommended'
  }
  return 'required'
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function primitiveNonEmpty(v) {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') {
    return v.trim().length > 0
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return true
  }
  return false
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function primitiveStringArrayNonEmpty(v) {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.some((x) => typeof x === 'string' && x.trim().length > 0)
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} section
 * @param {string} field dot-path within section value (empty = section root)
 * @returns {unknown}
 */
function getAtSectionField(data, section, field) {
  const sec = data[section]
  if (sec === undefined || sec === null) {
    return undefined
  }
  if (!field) {
    return sec
  }
  const parts = field.split('.')
  let cur = sec
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined
    }
    cur = /** @type {Record<string, unknown>} */ (cur)[p]
  }
  return cur
}

/**
 * @param {import('zod').ZodTypeAny} fs
 * @param {'required' | 'recommended'} sectionTier
 * @param {string} section
 * @param {string} fieldPath
 * @param {Array<
 *   | { kind: 'primitive'; section: string; field: string; tier: 'required' | 'recommended' }
 *   | { kind: 'primitiveArray'; section: string; field: string; tier: 'required' | 'recommended' }
 *   | { kind: 'arrayRows'; section: string; field: string; tier: 'required' | 'recommended'; rowKeys: string[] }
 * >} out
 */
function walkFieldSchema(fs, sectionTier, section, fieldPath, out) {
  if (sectionTier === 'required' && fs instanceof z.ZodOptional) {
    return
  }

  let inner = fs
  if (inner instanceof z.ZodOptional) {
    inner = inner.unwrap()
  }
  while (inner instanceof z.ZodDefault) {
    inner = inner.unwrap()
  }

  if (inner instanceof z.ZodObject) {
    for (const k of Object.keys(inner.shape)) {
      const child = inner.shape[k]
      const next = fieldPath ? `${fieldPath}.${k}` : k
      walkFieldSchema(child, sectionTier, section, next, out)
    }
    return
  }

  if (inner instanceof z.ZodArray) {
    const elem = inner.element
    if (elem instanceof z.ZodObject) {
      const rowKeys = Object.keys(elem.shape).filter((rk) => !(elem.shape[rk] instanceof z.ZodOptional))
      out.push({
        kind: 'arrayRows',
        section,
        field: fieldPath,
        tier: sectionTier,
        rowKeys,
      })
      return
    }
    if (hasDefaultEmptyArray(fs)) {
      return
    }
    out.push({ kind: 'primitiveArray', section, field: fieldPath, tier: sectionTier })
    return
  }

  out.push({ kind: 'primitive', section, field: fieldPath, tier: sectionTier })
}

/**
 * @param {import('zod').ZodObject<any>} rootSchema
 */
function collectCompletenessDescriptors(rootSchema) {
  /** @type {Array<
    | { kind: 'primitive'; section: string; field: string; tier: 'required' | 'recommended' }
    | { kind: 'primitiveArray'; section: string; field: string; tier: 'required' | 'recommended' }
    | { kind: 'arrayRows'; section: string; field: string; tier: 'required' | 'recommended'; rowKeys: string[] }
  >} */
  const out = []

  for (const section of Object.keys(rootSchema.shape)) {
    const sectionRoot = rootSchema.shape[section]
    const tier = tierForTopLevelSection(sectionRoot)

    let inner = sectionRoot
    while (inner instanceof z.ZodOptional) {
      inner = inner.unwrap()
    }
    while (inner instanceof z.ZodDefault) {
      inner = inner.unwrap()
    }

    if (inner instanceof z.ZodObject) {
      for (const k of Object.keys(inner.shape)) {
        walkFieldSchema(inner.shape[k], tier, section, k, out)
      }
    } else {
      walkFieldSchema(sectionRoot, tier, section, '', out)
    }
  }

  return out
}

/**
 * @param {BibleFieldRef} a
 * @param {BibleFieldRef} b
 * @returns {number}
 */
function cmpRef(a, b) {
  const s = a.section.localeCompare(b.section)
  if (s !== 0) return s
  return a.field.localeCompare(b.field)
}

/**
 * Weighted completeness vs Bible schema (required vs recommended leaves).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {CompletenessReport}
 */
export function getBibleCompleteness(db, entityId) {
  const entity = getEntity(db, entityId)
  if (!entity) {
    throw new EntityNotFoundError(entityId)
  }

  const nested = projectBibleNested(db, entityId)
  const rootSchema = bibleRootSchema(entity.type)
  const descriptors = collectCompletenessDescriptors(rootSchema)

  /** @type {BibleFieldRef[]} */
  const missingRequired = []
  /** @type {BibleFieldRef[]} */
  const missingRecommended = []

  let requiredCount = 0
  let recommendedCount = 0
  let presentRequired = 0
  let presentRecommended = 0

  for (const d of descriptors) {
    if (d.tier === 'required') {
      requiredCount += 1
    } else {
      recommendedCount += 1
    }

    const ref = { section: d.section, field: d.field }

    if (d.kind === 'primitive') {
      const v = getAtSectionField(nested, d.section, d.field)
      const ok = primitiveNonEmpty(v)
      if (ok) {
        if (d.tier === 'required') presentRequired += 1
        else presentRecommended += 1
      } else {
        if (d.tier === 'required') missingRequired.push(ref)
        else missingRecommended.push(ref)
      }
      continue
    }

    if (d.kind === 'primitiveArray') {
      const v = getAtSectionField(nested, d.section, d.field)
      const ok = primitiveStringArrayNonEmpty(v)
      if (ok) {
        if (d.tier === 'required') presentRequired += 1
        else presentRecommended += 1
      } else {
        if (d.tier === 'required') missingRequired.push(ref)
        else missingRecommended.push(ref)
      }
      continue
    }

    const arr = getAtSectionField(nested, d.section, d.field)
    const ok =
      Array.isArray(arr) &&
      arr.some((row) => {
        if (!row || typeof row !== 'object') return false
        const o = /** @type {Record<string, unknown>} */ (row)
        return d.rowKeys.every((k) => primitiveNonEmpty(o[k]))
      })
    if (ok) {
      if (d.tier === 'required') presentRequired += 1
      else presentRecommended += 1
    } else {
      if (d.tier === 'required') missingRequired.push(ref)
      else missingRecommended.push(ref)
    }
  }

  missingRequired.sort(cmpRef)
  missingRecommended.sort(cmpRef)

  const denom = requiredCount + recommendedCount * 0.5
  const ratio = denom <= 0 ? 1 : (presentRequired + presentRecommended * 0.5) / denom

  return {
    ratio,
    requiredCount,
    recommendedCount,
    presentRequired,
    presentRecommended,
    missingRequired,
    missingRecommended,
  }
}
