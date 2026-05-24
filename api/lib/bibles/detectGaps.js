import { getBibleCompleteness } from './completeness.js'
import { EntityNotFoundError } from './projection.js'
import { getEntity, listAttributes } from '../db/repositories.js'

/**
 * @typedef {'low' | 'medium' | 'high' | 'error'} GapSeverity
 */

/**
 * @typedef {{ field: string, severity: GapSeverity, suggestedStageId: number | null }} BibleGap
 */

/**
 * Extrapolation stage hint for a missing Bible leaf (character-shaped chain S1–S6 unless noted).
 *
 * @param {string} entityType
 * @param {string} section
 * @param {string} field
 * @returns {number | null}
 */
export function suggestedStageForBibleField(entityType, section, field) {
  const type = String(entityType || 'character').trim().toLowerCase()

  if (type === 'location') {
    if (section === 'geography') return 1
    if (section === 'inhabitants') return 2
    if (section === 'identity' || section === 'function') return 3
    if (section === 'visuals') return 1
    return 1
  }

  if (type === 'era' || type === 'prop') {
    return 1
  }

  if (section === 'demographics') {
    return field === 'eraLabel' ? 2 : 1
  }
  if (section === 'physical' || section === 'visuals') return 5
  if (section === 'psychology' || section === 'voice') return 3
  if (section === 'history') return 2
  if (section === 'wardrobe' || section === 'relationships') return 4
  return 1
}

/**
 * Bible-gap projection for autofill / agent tools: entity description + schema completeness.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @returns {BibleGap[]}
 */
export function detectEntityBibleGaps(db, entityId) {
  const entity = getEntity(db, entityId)
  if (!entity) {
    return [{ field: 'entity', severity: 'error', suggestedStageId: null }]
  }

  const attrs = listAttributes(db, { entityId })
  const keys = new Set(attrs.map((a) => a.key))

  /** @type {BibleGap[]} */
  const gaps = []

  if (!keys.has('description')) {
    gaps.push({ field: 'description', severity: 'high', suggestedStageId: 1 })
  }

  let report
  try {
    report = getBibleCompleteness(db, entityId)
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      return [{ field: 'entity', severity: 'error', suggestedStageId: null }]
    }
    throw err
  }

  for (const ref of report.missingRequired) {
    const fieldKey = `${ref.section}.${ref.field}`
    gaps.push({
      field: fieldKey,
      severity: 'high',
      suggestedStageId: suggestedStageForBibleField(entity.type, ref.section, ref.field),
    })
  }

  for (const ref of report.missingRecommended) {
    const fieldKey = `${ref.section}.${ref.field}`
    gaps.push({
      field: fieldKey,
      severity: 'medium',
      suggestedStageId: suggestedStageForBibleField(entity.type, ref.section, ref.field),
    })
  }

  gaps.sort((a, b) => {
    const severityRank = { error: 0, high: 1, medium: 2, low: 3 }
    const dr = (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
    if (dr !== 0) return dr
    const sa = a.suggestedStageId ?? 99
    const sb = b.suggestedStageId ?? 99
    if (sa !== sb) return sa - sb
    return a.field.localeCompare(b.field)
  })

  return gaps
}
