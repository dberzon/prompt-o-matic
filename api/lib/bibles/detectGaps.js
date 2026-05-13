import { getEntity, listAttributes } from '../db/repositories.js'

/**
 * Minimal Bible-gap projection for extrapolation tooling (Phase 2 placeholder until projectBible lands).
 * Returns structured gaps with optional suggested extrapolation stage ids.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {{ field: string, severity: 'low' | 'medium' | 'high' | 'error', suggestedStageId: number | null }[]}
 */
export function detectEntityBibleGaps(db, entityId) {
  const entity = getEntity(db, entityId)
  if (!entity) {
    return [{ field: 'entity', severity: 'error', suggestedStageId: null }]
  }
  const attrs = listAttributes(db, { entityId })
  const keys = new Set(attrs.map((a) => a.key))
  /** @type {{ field: string, severity: 'low' | 'medium' | 'high' | 'error', suggestedStageId: number | null }[]} */
  const gaps = []
  if (!keys.has('description')) {
    gaps.push({ field: 'description', severity: 'high', suggestedStageId: 1 })
  }
  return gaps
}
