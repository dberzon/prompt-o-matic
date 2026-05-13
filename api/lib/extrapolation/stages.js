import { callWithSchema } from '../llm/structuredOutput.js'
import { getPrompt } from '../prompts/registry.js'
import { renderPrompt } from '../prompts/render.js'
import { getEntity, listAttributes, listRelationships } from '../db/repositories.js'
import { applyS1Parser } from './parsers/s1Parser.js'
import { applyS2Parser } from './parsers/s2Parser.js'
import { applyS3Parser } from './parsers/s3Parser.js'
import { applyS4Parser } from './parsers/s4Parser.js'
import { applyS5Parser } from './parsers/s5Parser.js'
import { applyS6Parser } from './parsers/s6Parser.js'
import { s1EntityExtractionSchema } from './schemas/s1EntityExtraction.js'
import { S2HistoricalOutputSchema } from './schemas/s2Historical.js'
import { S3PsychologyOutputSchema } from './schemas/s3Psychology.js'
import { S4EnvironmentOutputSchema } from './schemas/s4Environment.js'
import { S5VisualDescriptorOutputSchema } from './schemas/s5VisualDescriptor.js'
import { S6ConflictOutputSchema } from './schemas/s6Conflict.js'
import { buildCanonSnapshot } from './stageCache.js'

function activeCanonAttributes(db, entityId) {
  return listAttributes(db, { entityId, provenance: 'canon' })
}

function activeAttributes(db, entityId) {
  return listAttributes(db, { entityId })
}

function formatAttrLine(item) {
  return `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`
}

/**
 * @param {import('./types.js').StageRunContext} ctx
 * @param {{ promptId: string; schema: import('zod').ZodTypeAny; variables: Record<string, unknown> }} opts
 */
async function runStructuredStage(ctx, { promptId, schema, variables }) {
  const stagePromptId = promptId
  const client = {
    /**
     * @param {{ promptId: string; variables?: Record<string, unknown>; providerPayload?: Record<string, unknown> }} opts
     */
    async chat(opts) {
      const vars = opts.variables || {}
      const rec = getPrompt(stagePromptId)
      const user = renderPrompt(rec.body, vars)
      const pp = opts.providerPayload || {}
      return ctx.llm({
        system: 'Return strict JSON only.',
        user,
        providerPayload: {
          ...pp,
          engine: pp.engine ?? 'auto',
          responseFormat: 'json',
          model: pp.model ?? ctx.modelId,
        },
      })
    },
  }
  return callWithSchema({
    client,
    promptId: stagePromptId,
    variables,
    schema,
    maxRetries: 1,
    providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
  })
}

function buildS1Dynamic({ entity, sourceText }) {
  return [
    `Primary entity: ${entity?.name || entity?.id || 'unknown'} (${entity?.type || 'character'})`,
    'Source text:',
    sourceText,
  ].join('\n')
}

function buildS2Dynamic({ entity, canonAttributes, prior }) {
  const eraAttrs = canonAttributes
    .filter(
      (item) =>
        /^(era|setting|culture|period|location)\./.test(item.key) ||
        ['era', 'setting', 'culture', 'period', 'location'].includes(item.key),
    )
    .map(formatAttrLine)
  const s1 = prior?.[1] || {}
  return [
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    eraAttrs.length ? `Canon era/setting:\n${eraAttrs.join('\n')}` : 'Canon era/setting: (none supplied)',
    s1?.raw ? `Stage 1 context:\n${JSON.stringify(s1.raw)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildS3Dynamic({ entity, canonAttributes, prior }) {
  const canonLines = canonAttributes.map(formatAttrLine)
  const stageTwo = prior?.[2]?.raw
  return [
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    canonLines.length ? `Canon attributes:\n${canonLines.join('\n')}` : 'Canon attributes: (none)',
    stageTwo ? `Stage 2 context:\n${JSON.stringify(stageTwo)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildS4Dynamic({ entity, canonAttributes, relationships, prior }) {
  const canonLines = canonAttributes.map(formatAttrLine)
  const relationshipLines = (relationships || []).map((item) => {
    const target = item.targetName || item.targetEntityId || 'unknown'
    return `${item.relationshipType || item.type || 'related_to'} -> ${target}`
  })
  return [
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    canonLines.length ? `Canon attributes:\n${canonLines.join('\n')}` : 'Canon attributes: (none)',
    relationshipLines.length ? `Relationships:\n${relationshipLines.join('\n')}` : 'Relationships: (none)',
    prior?.[3] ? `Stage 3 context:\n${JSON.stringify(prior[3].raw)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildS5Dynamic({ entity, attributes, prior }) {
  const attributeLines = attributes.map(formatAttrLine)
  return [
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    attributeLines.length ? `Attributes:\n${attributeLines.join('\n')}` : 'Attributes: (none)',
    prior?.[4] ? `Stage 4 context:\n${JSON.stringify(prior[4].raw)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildS6Dynamic({ entity, attributes, prior }) {
  const attributeLines = attributes.map((item) =>
    `${item.id} :: ${item.key} :: ${item.provenance} :: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`,
  )
  return [
    `Entity: ${entity?.name || entity?.id} (${entity?.type || 'character'})`,
    attributeLines.length ? `Active attributes:\n${attributeLines.join('\n')}` : 'Active attributes: (none)',
    prior ? `Prior stage outputs:\n${JSON.stringify(prior)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const extrapolationStages = [
  {
    id: 1,
    name: 'Entity extraction',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
      const sourceText =
        canonAttributes.find((item) => item.key === 'description')?.value || entity?.name || ''
      const raw = await runStructuredStage(ctx, {
        promptId: 'extrapolation.s1.entityExtraction',
        schema: s1EntityExtractionSchema,
        variables: { dynamicContext: buildS1Dynamic({ entity, sourceText }) },
      })
      const applied = applyS1Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.writes,
        suggestions: applied.suggestions,
        dropped: [],
        raw,
      }
    },
  },
  {
    id: 2,
    name: 'Historical/cultural enrichment',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
      const raw = await runStructuredStage(ctx, {
        promptId: 'extrapolation.s2.historical',
        schema: S2HistoricalOutputSchema,
        variables: { dynamicContext: buildS2Dynamic({ entity, canonAttributes, prior: ctx.prior }) },
      })
      const applied = applyS2Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.accepted,
        suggestions: [],
        conflicts: [],
        dropped: applied.dropped,
        raw,
      }
    },
  },
  {
    id: 3,
    name: 'Psychology enrichment',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
      const raw = await runStructuredStage(ctx, {
        promptId: 'extrapolation.s3.psychology',
        schema: S3PsychologyOutputSchema,
        variables: { dynamicContext: buildS3Dynamic({ entity, canonAttributes, prior: ctx.prior }) },
      })
      const applied = applyS3Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.accepted,
        suggestions: [],
        conflicts: [],
        dropped: applied.dropped,
        raw,
      }
    },
  },
  {
    id: 4,
    name: 'Environmental projection',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
      const relationships = listRelationships(ctx.db, { fromId: ctx.entityId })
      const raw = await runStructuredStage(ctx, {
        promptId: 'extrapolation.s4.environment',
        schema: S4EnvironmentOutputSchema,
        variables: {
          dynamicContext: buildS4Dynamic({ entity, canonAttributes, relationships, prior: ctx.prior }),
        },
      })
      const applied = applyS4Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.accepted,
        suggestions: applied.suggestions,
        dropped: applied.dropped,
        raw,
      }
    },
  },
  {
    id: 5,
    name: 'Visual descriptor',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const attributes = activeAttributes(ctx.db, ctx.entityId)
      const raw = await runStructuredStage(ctx, {
        promptId: 'extrapolation.s5.visualDescriptor',
        schema: S5VisualDescriptorOutputSchema,
        variables: { dynamicContext: buildS5Dynamic({ entity, attributes, prior: ctx.prior }) },
      })
      const s5 = applyS5Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: s5.accepted,
        suggestions: [],
        dropped: s5.dropped,
        raw,
      }
    },
  },
  {
    id: 6,
    name: 'Conflict detection',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const attributes = activeAttributes(ctx.db, ctx.entityId)
      const raw = await runStructuredStage(ctx, {
        promptId: 'extrapolation.s6.conflict',
        schema: S6ConflictOutputSchema,
        variables: { dynamicContext: buildS6Dynamic({ entity, attributes, prior: ctx.prior }) },
      })
      const applied = applyS6Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.accepted,
        suggestions: [],
        conflicts: applied.conflicts,
        dropped: applied.dropped,
        raw,
      }
    },
  },
]

export function getStageById(stageId) {
  return extrapolationStages.find((stage) => stage.id === stageId) || null
}

export function buildStageSnapshot(db, entityId) {
  return buildCanonSnapshot(listAttributes(db, { entityId, provenance: 'canon' }))
}
