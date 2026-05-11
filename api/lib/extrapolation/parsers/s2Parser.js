import { writeAttribute } from '../../db/repositories.js'

const DEFAULT_CONFIDENCE = 0.6

export function applyS2Parser(db, entityId, parsed) {
  const writes = []
  const attributes = Array.isArray(parsed?.attributes) ? parsed.attributes : []
  for (const item of attributes) {
    if (!item?.key) continue
    const confidence = typeof item.confidence === 'number'
      ? Math.min(1, Math.max(0, item.confidence))
      : DEFAULT_CONFIDENCE
    const written = writeAttribute(db, {
      entityId,
      key: item.key,
      value: item.value,
      provenance: 'inferred',
      confidence: Math.min(confidence, DEFAULT_CONFIDENCE),
      sourceStage: 2,
    })
    writes.push(written)
  }
  return writes
}
