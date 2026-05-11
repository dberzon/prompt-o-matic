import { writeAttribute } from '../../db/repositories.js'

export function applyS5Parser(db, entityId, parsed) {
  const descriptor = parsed?.visualDescriptor || parsed?.['visual.descriptor'] || ''
  if (!descriptor) return []
  return [writeAttribute(db, {
    entityId,
    key: 'visual.descriptor',
    value: descriptor,
    provenance: 'inferred',
    confidence: 0.85,
    sourceStage: 5,
  })]
}
