import { writeAttribute } from '../../db/repositories.js'

const ALLOWED_PREFIXES = ['behavior.', 'speech.', 'fear.']

export function applyS3Parser(db, entityId, parsed) {
  const writes = []
  const attributes = Array.isArray(parsed?.attributes) ? parsed.attributes : []
  for (const item of attributes) {
    if (!item?.key) continue
    if (!ALLOWED_PREFIXES.some((prefix) => item.key.startsWith(prefix))) continue
    writes.push(writeAttribute(db, {
      entityId,
      key: item.key,
      value: item.value,
      provenance: 'inferred',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
      sourceStage: 3,
    }))
  }
  return writes
}
