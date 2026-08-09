import { z } from 'zod'
import { CharacterBibleSchema } from '../bibles/schemas/characterBible.schema.js'
import { LocationBibleSchema } from '../bibles/schemas/locationBible.schema.js'
import { attributeKeyHasUnsafeSegment, getEntity, listAttributes, writeAttribute } from '../db/repositories.js'

export const WriteAttributeRowSchema = z
  .object({
    key: z.string().min(1),
    value: z.unknown(),
    provenance: z.enum(['canon', 'inferred', 'suggested', 'temporary', 'derived']),
    confidence: z.number().min(0).max(1).optional().nullable(),
    sourceStage: z.union([z.number(), z.string()]).optional().nullable(),
  })
  .strict()

const EXTRA_CHARACTER_ROOTS = new Set([
  'name',
  'summary',
  'visual',
  'conflict',
  'relation',
  'appearance',
  'behavior',
  'psychology',
  'culture',
  'home',
  'routine',
  'setting',
  'era',
  'description',
  'eyes',
  'hair',
  'mood',
  'wardrobe',
])

const CHARACTER_ROOTS = new Set([...Object.keys(CharacterBibleSchema.shape), ...EXTRA_CHARACTER_ROOTS])

const EXTRA_LOCATION_ROOTS = new Set(['name', 'description', 'summary'])
const LOCATION_ROOTS = new Set([...Object.keys(LocationBibleSchema.shape), ...EXTRA_LOCATION_ROOTS])

const SAFE_KEY = /^[a-zA-Z0-9_.:\-]+$/

/**
 * @param {string} entityType
 * @param {string} key
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateAttributeKeyForEntityType(entityType, key) {
  if (!SAFE_KEY.test(key)) {
    return { ok: false, reason: 'invalid_key_charset' }
  }
  if (attributeKeyHasUnsafeSegment(key)) {
    return { ok: false, reason: 'unsafe_key_segment' }
  }
  const root = key.includes('.') ? key.slice(0, key.indexOf('.')) : key
  if (entityType === 'character') {
    if (CHARACTER_ROOTS.has(root)) return { ok: true }
    return { ok: false, reason: `invalid_character_key_root:${root}` }
  }
  if (entityType === 'environment' || entityType === 'location') {
    if (LOCATION_ROOTS.has(root)) return { ok: true }
    return { ok: false, reason: `invalid_environment_key_root:${root}` }
  }
  if (entityType === 'prop' || entityType === 'institution') {
    return { ok: true }
  }
  return { ok: false, reason: `unknown_entity_type:${entityType}` }
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ entityId: string; attributes: unknown[] }} params
 */
export function writeAttributesBatch(db, { entityId, attributes }) {
  const entity = getEntity(db, entityId)
  if (!entity) {
    throw new Error(`writeAttributesBatch: entity not found: ${entityId}`)
  }

  /** @type {Array<Record<string, unknown>>} */
  const written = []
  /** @type {Array<{ key: string; value: unknown; provenance: string }>} */
  const deduped = []
  /** @type {Array<{ index: number; reason: string; detail?: unknown }>} */
  const rejected = []

  if (!Array.isArray(attributes)) {
    throw new Error('writeAttributesBatch: attributes must be an array')
  }

  attributes.forEach((raw, index) => {
    const parsed = WriteAttributeRowSchema.safeParse(raw)
    if (!parsed.success) {
      rejected.push({ index, reason: 'schema_invalid', detail: parsed.error.flatten() })
      return
    }
    const row = parsed.data
    const keyCheck = validateAttributeKeyForEntityType(entity.type, row.key)
    if (!keyCheck.ok) {
      rejected.push({ index, reason: keyCheck.reason })
      return
    }

    const existing = listAttributes(db, { entityId, key: row.key })
    const dup = existing.find(
      (a) =>
        valuesEqual(a.value, row.value) &&
        a.provenance === row.provenance &&
        !a.dismissedAt &&
        !a.supersededBy,
    )
    if (dup) {
      deduped.push({ key: row.key, value: row.value, provenance: row.provenance })
      return
    }

    const saved = writeAttribute(db, {
      entityId,
      key: row.key,
      value: row.value,
      provenance: row.provenance,
      confidence: row.confidence ?? undefined,
      sourceStage: row.sourceStage ?? undefined,
    })
    if (!saved?.provenance) {
      rejected.push({ index, reason: 'write_missing_provenance' })
      return
    }
    written.push(saved)
  })

  return { written, deduped, rejected }
}
