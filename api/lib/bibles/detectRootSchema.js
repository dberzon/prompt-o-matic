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
 * @param {string} entityType
 * @returns {import('zod').ZodObject<any>}
 */
export function bibleRootSchemaForEntityType(entityType) {
  switch (entityType) {
    case 'character':
    case 'environment':
    case 'institution':
      return CharacterBibleSchema
    case 'location':
      return LocationBibleSchema
    case 'era':
      return EraBibleSchema
    case 'prop':
      return PropBibleSchema
    default:
      throw new Error(`bibleRootSchemaForEntityType: unsupported entity type: ${entityType}`)
  }
}

/**
 * Pick the Zod root schema for a projected Bible JSON shape (no PDF / render deps).
 *
 * @param {Record<string, unknown>} bible
 * @param {string} [entityType] — used when projection is empty (e.g. after bank lift)
 * @returns {import('zod').ZodObject<any>}
 */
export function detectBibleRootSchema(bible, entityType) {
  const o = stripProvenance(bible)
  if ('demographics' in o) return CharacterBibleSchema
  if ('geography' in o && 'identity' in o) return LocationBibleSchema
  if ('timeframe' in o) return EraBibleSchema
  if ('function' in o && 'visuals' in o && !('demographics' in o) && !('geography' in o)) return PropBibleSchema
  if (entityType) return bibleRootSchemaForEntityType(entityType)
  throw new Error('detectBibleRootSchema: unrecognized bible projection shape')
}
