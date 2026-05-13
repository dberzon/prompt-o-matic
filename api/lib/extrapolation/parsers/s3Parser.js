import { writeAttribute } from '../../db/repositories.js'

const ALLOWED_PREFIXES = ['behavior.', 'speech.', 'fear.']

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @returns {import('./parserResult.js').ParserResult<ReturnType<typeof writeAttribute>>}
 */
export function applyS3Parser(db, entityId, parsed) {
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
    if (!ALLOWED_PREFIXES.some((prefix) => item.key.startsWith(prefix))) {
      dropped.push({ key: item.key, reason: 'psychology_key_prefix_not_allowed', raw: item })
      continue
    }
    accepted.push(writeAttribute(db, {
      entityId,
      key: item.key,
      value: item.value,
      provenance: 'inferred',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
      sourceStage: 3,
    }))
  }
  return { accepted, dropped }
}
