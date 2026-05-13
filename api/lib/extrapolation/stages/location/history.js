import { getEntity, listAttributes } from '../../../db/repositories.js'
import { runLocationStructuredStage } from './common.js'
import { LocationHistoryStageSchema } from './schemas.js'
import { applyLocationHistoryParser, persistLocationDropDiagnostics } from './parsers.js'

function formatAttrLine(item) {
  return `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`
}

function buildDynamic({ entity, attrs, prior }) {
  const lines = attrs.map(formatAttrLine)
  const inh = prior?.[2]?.raw
  return [
    `Location entity: ${entity?.name || entity?.id || 'unknown'}`,
    lines.length ? `Known attributes:\n${lines.join('\n')}` : 'Attributes: (none)',
    inh ? `Inhabitants stage output:\n${JSON.stringify(inh)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const historyStage = {
  id: 3,
  name: 'Location history & atmosphere',
  /**
   * @param {import('../../types.js').StageRunContext} ctx
   */
  async run(ctx) {
    const entity = getEntity(ctx.db, ctx.entityId)
    const attrs = listAttributes(ctx.db, { entityId: ctx.entityId })
    const raw = await runLocationStructuredStage(ctx, {
      promptId: 'location.history',
      schema: LocationHistoryStageSchema,
      variables: {
        dynamicContext: buildDynamic({ entity, attrs, prior: ctx.prior }),
      },
    })
    const applied = applyLocationHistoryParser(ctx.db, ctx.entityId, raw, { sourceStage: 3 })
    const dropWrites = persistLocationDropDiagnostics(ctx.db, ctx.entityId, 3, applied.dropped)
    return {
      writes: [...applied.writes, ...dropWrites],
      suggestions: applied.suggestions || [],
      conflicts: applied.conflicts || [],
      dropped: applied.dropped,
      raw,
    }
  },
}
