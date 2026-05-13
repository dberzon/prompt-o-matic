import { writeAttribute } from '../../db/repositories.js'

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @returns {import('./parserResult.js').ParserResult<ReturnType<typeof writeAttribute>> & { conflicts: unknown[] }}
 */
export function applyS6Parser(db, entityId, parsed) {
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const accepted = []
  /** @type {import('./parserResult.js').ParserDropped[]} */
  const dropped = []
  const conflicts = Array.isArray(parsed?.conflicts) ? parsed.conflicts : []
  for (const conflict of conflicts) {
    if (!conflict?.message) {
      dropped.push({
        key: conflict?.key != null ? String(conflict.key) : null,
        reason: 'conflict_missing_message',
        raw: conflict,
      })
      continue
    }
    accepted.push(writeAttribute(db, {
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
  return { accepted, dropped, conflicts }
}
