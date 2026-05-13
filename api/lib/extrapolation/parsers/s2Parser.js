import { writeAttribute } from '../../db/repositories.js'

const DEFAULT_CONFIDENCE = 0.6

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @returns {import('./parserResult.js').ParserResult<ReturnType<typeof writeAttribute>>}
 */
export function applyS2Parser(db, entityId, parsed) {
  /** @type {ReturnType<typeof writeAttribute>[]} */
  const accepted = []
  /** @type {import('./parserResult.js').ParserDropped[]} */
  const dropped = []
  const attributes = Array.isArray(parsed?.attributes) ? parsed.attributes : []
  for (const item of attributes) {
    if (!item?.key) {
      dropped.push({ key: null, reason: 'missing_attribute_key', raw: item })
      continue
    }
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
    accepted.push(written)
  }
  return { accepted, dropped }
}
