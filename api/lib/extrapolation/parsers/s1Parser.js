import { createEntity, getEntity, listAttributes, writeAttribute } from '../../db/repositories.js'
import { parseS1EntityExtractionOutput } from '../schemas/s1EntityExtraction.js'

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Write S1 extraction as canon only when the key has no active canon head.
 * Re-runs (or runs after Bible edits / bank lift) must not insert a newer
 * canon row for the same key — projection picks newest same-provenance leaf
 * and would silently shadow the user's Bible value.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {string} key
 * @param {unknown} value
 * @returns {ReturnType<typeof writeAttribute> | null}
 */
function writeS1CanonAttribute(db, entityId, key, value) {
  const active = listAttributes(db, { entityId, key })
  if (active.some((row) => row.provenance === 'canon')) {
    return null
  }
  return writeAttribute(db, {
    entityId,
    key,
    value,
    provenance: 'canon',
    confidence: 1,
    sourceStage: 1,
  })
}

export function applyS1Parser(db, primaryEntityId, raw) {
  const parsed = parseS1EntityExtractionOutput(raw)
  const writes = []
  const suggestions = []

  for (const item of parsed.primary.attributes) {
    if (!item?.key) {
      continue
    }
    const written = writeS1CanonAttribute(db, primaryEntityId, item.key, item.value)
    if (written) writes.push(written)
  }

  for (const entity of parsed.entities) {
    const slug = normalizeSlug(entity.slug || entity.name)
    if (!slug) continue
    let record = getEntity(db, slug)
    if (!record) {
      record = createEntity(db, {
        id: slug,
        type: entity.type,
        name: entity.name,
      })
      suggestions.push(record)
    }
    const attrs = entity.attributes?.length
      ? entity.attributes
      : [{ key: 'name', value: entity.name }]
    for (const item of attrs) {
      if (!item?.key) {
        continue
      }
      const written = writeS1CanonAttribute(db, record.id, item.key, item.value)
      if (written) writes.push(written)
    }
  }

  return { writes, suggestions }
}
