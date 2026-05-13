import { getEntity, listAttributes } from '../../../db/repositories.js'
import { runLocationStructuredStage } from './common.js'
import { LocationInhabitantsStageSchema } from './schemas.js'
import { applyLocationInhabitantsParser, persistLocationDropDiagnostics } from './parsers.js'

function formatAttrLine(item) {
  return `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`
}

function buildDynamic({ entity, canonAttributes, prior }) {
  const lines = canonAttributes.map(formatAttrLine)
  const g = prior?.[1]?.raw
  return [
    `Location entity: ${entity?.name || entity?.id || 'unknown'}`,
    lines.length ? `Canon + inferred attributes:\n${lines.join('\n')}` : 'Attributes: (none)',
    g ? `Geography stage output:\n${JSON.stringify(g)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const inhabitantsStage = {
  id: 2,
  name: 'Location inhabitants',
  /**
   * @param {import('../../types.js').StageRunContext} ctx
   */
  async run(ctx) {
    const entity = getEntity(ctx.db, ctx.entityId)
    const canon = listAttributes(ctx.db, { entityId: ctx.entityId })
    const raw = await runLocationStructuredStage(ctx, {
      promptId: 'location.inhabitants',
      schema: LocationInhabitantsStageSchema,
      variables: {
        dynamicContext: buildDynamic({
          entity,
          canonAttributes: canon,
          prior: ctx.prior,
        }),
      },
    })
    const applied = applyLocationInhabitantsParser(ctx.db, ctx.entityId, raw, { sourceStage: 2 })
    const dropWrites = persistLocationDropDiagnostics(ctx.db, ctx.entityId, 2, applied.dropped)
    return {
      writes: [...applied.writes, ...dropWrites],
      suggestions: applied.suggestions || [],
      conflicts: applied.conflicts || [],
      dropped: applied.dropped,
      raw,
    }
  },
}
