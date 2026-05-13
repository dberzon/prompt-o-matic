import { getEntity, listAttributes } from '../../../db/repositories.js'
import { runLocationStructuredStage } from './common.js'
import { LocationGeographyStageSchema } from './schemas.js'
import { applyLocationGeographyParser, persistLocationDropDiagnostics } from './parsers.js'

function activeCanonAttributes(db, entityId) {
  return listAttributes(db, { entityId, provenance: 'canon' })
}

function formatAttrLine(item) {
  return `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`
}

function buildDynamic({ entity, canonAttributes, prior }) {
  const lines = canonAttributes.map(formatAttrLine)
  const prior1 = prior?.[1]?.raw
  return [
    `Location entity: ${entity?.name || entity?.id || 'unknown'} (${entity?.type || 'location'})`,
    lines.length ? `Canon attributes:\n${lines.join('\n')}` : 'Canon attributes: (none yet)',
    prior1 ? `Prior geography stage context:\n${JSON.stringify(prior1)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const geographyStage = {
  id: 1,
  name: 'Location geography',
  /**
   * @param {import('../../types.js').StageRunContext} ctx
   */
  async run(ctx) {
    const entity = getEntity(ctx.db, ctx.entityId)
    const canon = activeCanonAttributes(ctx.db, ctx.entityId)
    const raw = await runLocationStructuredStage(ctx, {
      promptId: 'location.geography',
      schema: LocationGeographyStageSchema,
      variables: { dynamicContext: buildDynamic({ entity, canonAttributes: canon, prior: ctx.prior }) },
    })
    const applied = applyLocationGeographyParser(ctx.db, ctx.entityId, raw, { sourceStage: 1 })
    const dropWrites = persistLocationDropDiagnostics(ctx.db, ctx.entityId, 1, applied.dropped)
    return {
      writes: [...applied.writes, ...dropWrites],
      suggestions: applied.suggestions || [],
      conflicts: applied.conflicts || [],
      dropped: applied.dropped,
      raw,
    }
  },
}
