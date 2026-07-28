import { createEntity, getEntity, writeAttribute } from '../../db/repositories.js'
import { parseS1EntityExtractionOutput } from '../schemas/s1EntityExtraction.js'

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Scope related-entity ids to the primary character so S1 cannot collide with
 * lift-from-bank Bibles (which use bare character slugs as entity ids) or reuse
 * another character's related entities.
 * Matches S4's `env_${slug}_${entityId}` pattern.
 */
function scopedRelatedEntityId(slug, primaryEntityId) {
  return `${slug}_${primaryEntityId}`.slice(0, 120)
}

export function applyS1Parser(db, primaryEntityId, raw) {
  const parsed = parseS1EntityExtractionOutput(raw)
  const writes = []
  const suggestions = []
  /** @type {Set<string>} */
  const seenRelatedIds = new Set()

  for (const item of parsed.primary.attributes) {
    if (!item?.key) {
      continue
    }
    writes.push(writeAttribute(db, {
      entityId: primaryEntityId,
      key: item.key,
      value: item.value,
      provenance: 'canon',
      confidence: 1,
      sourceStage: 1,
    }))
  }

  for (const entity of parsed.entities) {
    const slug = normalizeSlug(entity.slug || entity.name)
    if (!slug) continue
    const relatedId = scopedRelatedEntityId(slug, primaryEntityId)
    // Never attach related-entity writes onto the primary Bible itself.
    if (relatedId === primaryEntityId || slug === primaryEntityId) continue
    if (seenRelatedIds.has(relatedId)) continue
    seenRelatedIds.add(relatedId)

    let record = getEntity(db, relatedId)
    if (!record) {
      record = createEntity(db, {
        id: relatedId,
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
      writes.push(writeAttribute(db, {
        entityId: record.id,
        key: item.key,
        value: item.value,
        provenance: 'canon',
        confidence: 1,
        sourceStage: 1,
      }))
    }
  }

  return { writes, suggestions }
}
