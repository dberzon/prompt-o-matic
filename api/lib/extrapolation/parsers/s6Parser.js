import { writeAttribute } from '../../db/repositories.js'

export function applyS6Parser(db, entityId, parsed) {
  const writes = []
  const conflicts = Array.isArray(parsed?.conflicts) ? parsed.conflicts : []
  for (const conflict of conflicts) {
    if (!conflict?.message) continue
    writes.push(writeAttribute(db, {
      entityId,
      key: `conflict.${conflict.key || 'general'}`,
      value: {
        message: conflict.message,
        attributeIds: conflict.attributeIds || [],
      },
      provenance: 'suggested',
      confidence: 0.9,
      sourceStage: 6,
    }))
  }
  return { writes, conflicts }
}
