import { CharacterBibleSchema } from './schemas/characterBible.schema.js'
import { EraBibleSchema } from './schemas/eraBible.schema.js'
import { LocationBibleSchema } from './schemas/locationBible.schema.js'
import { PropBibleSchema } from './schemas/propBible.schema.js'

/**
 * @param {unknown} bible
 * @returns {Record<string, unknown>}
 */
export function stripProvenance(bible) {
  if (!bible || typeof bible !== 'object') return {}
  const { _provenance: _p, ...rest } = /** @type {Record<string, unknown>} */ (bible)
  return rest
}

/**
 * Pick the Zod root schema for a projected Bible JSON shape (no PDF / render deps).
 *
 * @param {Record<string, unknown>} bible
 * @returns {import('zod').ZodObject<any>}
 */
export function detectBibleRootSchema(bible) {
  const o = stripProvenance(bible)
  if ('demographics' in o) return CharacterBibleSchema
  if ('geography' in o && 'identity' in o) return LocationBibleSchema
  if ('timeframe' in o) return EraBibleSchema
  if ('function' in o && 'visuals' in o && !('demographics' in o) && !('geography' in o)) return PropBibleSchema
  throw new Error('renderBibleMarkdown: unrecognized bible projection shape')
}
