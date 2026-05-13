import { writeAttribute } from '../../db/repositories.js'

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} entityId
 * @param {unknown} parsed
 * @returns {import('./parserResult.js').ParserResult<ReturnType<typeof writeAttribute>>}
 */
export function applyS5Parser(db, entityId, parsed) {
  /** @type {import('./parserResult.js').ParserDropped[]} */
  const dropped = []
  const descriptor = parsed?.visualDescriptor || parsed?.['visual.descriptor'] || ''
  if (!descriptor) {
    dropped.push({ key: 'visual.descriptor', reason: 'missing_visual_descriptor', raw: parsed })
    return { accepted: [], dropped }
  }
  return {
    accepted: [writeAttribute(db, {
      entityId,
      key: 'visual.descriptor',
      value: descriptor,
      provenance: 'inferred',
      confidence: 0.85,
      sourceStage: 5,
    })],
    dropped: [],
  }
}
