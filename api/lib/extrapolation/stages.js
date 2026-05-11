import { parseJsonFromLlmText } from '../characters/jsonUtils.js'
import { getEntity, listAttributes, listRelationships } from '../db/repositories.js'
import { applyS1Parser } from './parsers/s1Parser.js'
import { applyS2Parser } from './parsers/s2Parser.js'
import { applyS3Parser } from './parsers/s3Parser.js'
import { applyS4Parser } from './parsers/s4Parser.js'
import { applyS5Parser } from './parsers/s5Parser.js'
import { applyS6Parser } from './parsers/s6Parser.js'
import { buildS1EntityExtractionPrompt } from './prompts/s1EntityExtraction.js'
import { buildS2HistoricalEnrichmentPrompt } from './prompts/s2HistoricalEnrichment.js'
import { buildS3PsychologicalInferencePrompt } from './prompts/s3PsychologicalInference.js'
import { buildS4EnvironmentalProjectionPrompt } from './prompts/s4EnvironmentalProjection.js'
import { buildS5VisualDescriptorPrompt } from './prompts/s5VisualDescriptor.js'
import { buildS6ConflictDetectionPrompt } from './prompts/s6ConflictDetection.js'
import { buildCanonSnapshot } from './stageCache.js'

function activeCanonAttributes(db, entityId) {
  return listAttributes(db, { entityId, provenance: 'canon' })
}

function activeAttributes(db, entityId) {
  return listAttributes(db, { entityId })
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
    conflicts: Array.isArray(applied?.conflicts) ? applied.conflicts : [],
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
      const sourceText = canonAttributes.find((item) => item.key === 'description')?.value
        || entity?.name
        || ''
      const rawText = await ctx.llm({
        system: 'Return strict JSON only.',
        user: buildS1EntityExtractionPrompt({ entity, sourceText }),
        providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
      })
      const raw = parseJsonFromLlmText(rawText)
      const applied = applyS1Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.writes,
        suggestions: applied.suggestions,
        raw,
      }
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
      return runJsonStage({
        ctx,
        system: 'Return strict JSON only.',
        buildUser: ({ entity, canonAttributes, prior }) => buildS3PsychologicalInferencePrompt({ entity, canonAttributes, prior }),
        apply: applyS3Parser,
      })
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
      const attributes = activeAttributes(ctx.db, ctx.entityId)
      const rawText = await ctx.llm({
        system: 'Return strict JSON only.',
        user: buildS5VisualDescriptorPrompt({
          entity,
          attributes,
          prior: ctx.prior,
        }),
        providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
      })
      const raw = parseJsonFromLlmText(rawText)
      return {
        writes: applyS5Parser(ctx.db, ctx.entityId, raw),
        suggestions: [],
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
      const rawText = await ctx.llm({
        system: 'Return strict JSON only.',
        user: buildS6ConflictDetectionPrompt({
          entity,
          attributes,
          prior: ctx.prior,
        }),
        providerPayload: { engine: 'auto', responseFormat: 'json', model: ctx.modelId },
      })
      const raw = parseJsonFromLlmText(rawText)
      const applied = applyS6Parser(ctx.db, ctx.entityId, raw)
      return {
        writes: applied.writes,
        suggestions: [],
        conflicts: applied.conflicts,
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
