import { extrapolationStages } from './stages.js'

/** DB entity kinds that share the character-shaped six-stage extrapolation chain until dedicated chains exist. */
const CHARACTER_SHAPED_ENTITY_TYPES = new Set(['character', 'environment', 'prop', 'institution'])

export class UnknownExtrapolationEntityTypeError extends Error {
  /**
   * @param {unknown} entityType
   */
  constructor(entityType) {
    const label =
      entityType === undefined || entityType === null ? String(entityType) : String(entityType)
    super(`No extrapolation chain registered for entity type: ${label}`)
    this.name = 'UnknownExtrapolationEntityTypeError'
    this.code = 'UNKNOWN_EXTRAPOLATION_ENTITY_TYPE'
    this.status = 400
    this.entityType = entityType
  }
}

async function noopStageRun() {
  return {
    writes: [],
    suggestions: [],
    conflicts: [],
    dropped: [],
    raw: null,
  }
}

/**
 * @param {'location' | 'era'} kind
 * @returns {import('./types.js').ExtrapolationStage[]}
 */
function buildPlaceholderChain(kind) {
  return [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    name: `Placeholder (${kind})`,
    run: noopStageRun,
  }))
}

const locationChain = buildPlaceholderChain('location')
const eraChain = buildPlaceholderChain('era')

/**
 * Resolve the ordered extrapolation stage chain for an entity `type` value from the DB.
 *
 * @param {unknown} entityType
 * @returns {import('./types.js').ExtrapolationStage[]}
 */
export function chainFor(entityType) {
  const raw = String(entityType ?? 'character').trim().toLowerCase()
  if (raw === 'location') return locationChain
  if (raw === 'era') return eraChain
  if (CHARACTER_SHAPED_ENTITY_TYPES.has(raw)) return extrapolationStages
  throw new UnknownExtrapolationEntityTypeError(entityType)
}
