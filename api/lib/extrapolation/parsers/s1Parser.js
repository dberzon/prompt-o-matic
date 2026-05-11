import { createEntity, getEntity, writeAttribute } from '../../db/repositories.js'
import { parseS1EntityExtractionOutput } from '../schemas/s1EntityExtraction.js'

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function applyS1Parser(db, primaryEntityId, raw) {
  const parsed = parseS1EntityExtractionOutput(raw)
  const writes = []
  const suggestions = []

  for (const item of parsed.primary.attributes) {
    if (!item?.key) continue
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
      if (!item?.key) continue
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
