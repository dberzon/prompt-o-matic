import { parseJsonFromLlmText } from '../characters/jsonUtils.js'
import { getEntity, listAttributes, listRelationships, writeAttribute } from '../db/repositories.js'
import { applyS2Parser } from './parsers/s2Parser.js'
import { applyS4Parser } from './parsers/s4Parser.js'
import { buildS2HistoricalEnrichmentPrompt } from './prompts/s2HistoricalEnrichment.js'
import { buildS4EnvironmentalProjectionPrompt } from './prompts/s4EnvironmentalProjection.js'
import { buildCanonSnapshot } from './stageCache.js'

function activeCanonAttributes(db, entityId) {
  return listAttributes(db, { entityId, provenance: 'canon' })
}

async function runJsonStage({ ctx, system, buildUser, apply }) {
  const entity = getEntity(ctx.db, ctx.entityId)
  const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
  const user = buildUser({ entity, canonAttributes, prior: ctx.prior })
  const rawText = await ctx.llm({
    system,
    user,
    providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
  })
  const raw = parseJsonFromLlmText(rawText)
  const applied = apply(ctx.db, ctx.entityId, raw)
  return {
    writes: Array.isArray(applied) ? applied : applied.writes,
    suggestions: Array.isArray(applied?.suggestions) ? applied.suggestions : [],
    raw,
  }
}

export const extrapolationStages = [
  {
    id: 1,
    name: 'Entity extraction',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
      const description = canonAttributes.find((item) => item.key === 'description')?.value
        || entity?.name
        || ''
      const writes = []
      if (description && !canonAttributes.some((item) => item.key === 'description')) {
        writes.push(writeAttribute(ctx.db, {
          entityId: ctx.entityId,
          key: 'description',
          value: description,
          provenance: 'canon',
          confidence: 1,
          sourceStage: 1,
        }))
      }
      return { writes, suggestions: [], raw: { description } }
    },
  },
  {
    id: 2,
    name: 'Historical/cultural enrichment',
    async run(ctx) {
      return runJsonStage({
        ctx,
        system: 'Return strict JSON only.',
        buildUser: ({ entity, canonAttributes, prior }) => buildS2HistoricalEnrichmentPrompt({ entity, canonAttributes, prior }),
        apply: applyS2Parser,
      })
    },
  },
  {
    id: 3,
    name: 'Psychology enrichment',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const rawText = await ctx.llm({
        system: 'Return strict JSON only: { "attributes": [ { "key": "psychology.*", "value": "string", "confidence": 0.0-1.0 } ] }',
        user: `Infer psychology attributes for ${entity?.name || ctx.entityId}.`,
        providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
      })
      const raw = parseJsonFromLlmText(rawText)
      const writes = []
      for (const item of raw?.attributes || []) {
        if (!item?.key) continue
        writes.push(writeAttribute(ctx.db, {
          entityId: ctx.entityId,
          key: item.key,
          value: item.value,
          provenance: 'inferred',
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
          sourceStage: 3,
        }))
      }
      return { writes, suggestions: [], raw }
    },
  },
  {
    id: 4,
    name: 'Environmental projection',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const canonAttributes = activeCanonAttributes(ctx.db, ctx.entityId)
      const relationships = listRelationships(ctx.db, { fromId: ctx.entityId })
      const rawText = await ctx.llm({
        system: 'Return strict JSON only.',
        user: buildS4EnvironmentalProjectionPrompt({
          entity,
          canonAttributes,
          relationships,
          prior: ctx.prior,
        }),
        providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
      })
      const raw = parseJsonFromLlmText(rawText)
      const applied = applyS4Parser(ctx.db, ctx.entityId, raw)
      return { writes: applied.writes, suggestions: applied.suggestions, raw }
    },
  },
  {
    id: 5,
    name: 'Visual descriptor',
    async run(ctx) {
      const entity = getEntity(ctx.db, ctx.entityId)
      const attributes = listAttributes(ctx.db, { entityId: ctx.entityId })
      const rawText = await ctx.llm({
        system: 'Return strict JSON only: { "visualDescriptor": "string" }',
        user: `Write a concise frontal portrait visual.descriptor for ${entity?.name || ctx.entityId} using:\n${attributes.map((item) => `${item.key}: ${item.value}`).join('\n')}`,
        providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
      })
      const raw = parseJsonFromLlmText(rawText)
      const descriptor = raw?.visualDescriptor || raw?.['visual.descriptor'] || ''
      const writes = descriptor
        ? [writeAttribute(ctx.db, {
          entityId: ctx.entityId,
          key: 'visual.descriptor',
          value: descriptor,
          provenance: 'inferred',
          confidence: 0.85,
          sourceStage: 5,
        })]
        : []
      return { writes, suggestions: [], raw }
    },
  },
  {
    id: 6,
    name: 'Conflict detection',
    async run(ctx) {
      const attributes = listAttributes(ctx.db, { entityId: ctx.entityId })
      const byKey = new Map()
      const conflicts = []
      for (const item of attributes) {
        if (!item?.key || item.dismissedAt || item.supersededBy) continue
        const prior = byKey.get(item.key)
        if (prior && prior.value !== item.value && prior.provenance !== item.provenance) {
          conflicts.push({ key: item.key, existing: prior, incoming: item })
        } else {
          byKey.set(item.key, item)
        }
      }
      return { writes: [], suggestions: [], conflicts, raw: { conflicts } }
    },
  },
]

export function getStageById(stageId) {
  return extrapolationStages.find((stage) => stage.id === stageId) || null
}

export function buildStageSnapshot(db, entityId) {
  return buildCanonSnapshot(listAttributes(db, { entityId, provenance: 'canon' }))
}
