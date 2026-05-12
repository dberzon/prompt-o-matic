import { listRelationships } from '../db/repositories.js'
import { IPADAPTER_QWEN_DECISION } from '../comfy/ipadapterFeasibility.js'
import { resolveStageModelConfig } from '../extrapolation/modelRouting.js'

export const HISTORICAL_FACT_CHECK_STAGE = 2
export const HISTORICAL_CONFIDENCE_CEILING = 0.6
export const GRAPH_BACKEND_RELATIONSHIP_THRESHOLD = 500

export const DEFERRED_P2_CAPABILITIES = [
  {
    id: 'historical-fact-checking',
    beadsId: '1et3',
    title: 'Full historical fact-checking',
    status: 'deferred',
    v1Mitigation: 'Stage 2 caps inferred confidence at 0.6; reviewer approval is the fact-check.',
  },
  {
    id: 'graph-database-backend',
    beadsId: '20m7',
    title: 'Graph database backend',
    status: 'deferred',
    v1Mitigation: 'SQLite FK rows remain canonical until relationship traversal exceeds the configured threshold.',
  },
  {
    id: 'per-character-lora-training',
    beadsId: '7miu',
    title: 'Per-character LoRA training pipeline',
    status: 'deferred',
    v1Mitigation: 'Reference-image continuity path remains primary; LoRA escalation is recommended only when QA scores miss threshold.',
  },
  {
    id: 'multi-user-collaboration',
    beadsId: 'cmv5',
    title: 'Multi-user collaboration / sharing',
    status: 'deferred',
    v1Mitigation: 'Local-first single-workspace operation; collaboration endpoints remain disabled.',
  },
  {
    id: 'cloud-inference-routing',
    beadsId: 'f2ji',
    title: 'Cloud inference routing',
    status: 'deferred',
    v1Mitigation: 'Local Ollama/LM Studio/Claude providers stay default; optional cloud base URL is opt-in only.',
  },
  {
    id: 'video-generation',
    beadsId: 'icqy',
    title: 'Video generation',
    status: 'deferred',
    v1Mitigation: 'Image generation and continuity QA only; video export is not exposed.',
  },
  {
    id: 'standalone-location-generation',
    beadsId: 'rd2r',
    title: 'Auto-generated locations independent of characters',
    status: 'deferred',
    v1Mitigation: 'Stage 4 environments are projected from character canon and relationships.',
  },
]

export function needsHistoricalFactReview(attribute) {
  if (!attribute || attribute.sourceStage !== HISTORICAL_FACT_CHECK_STAGE) return false
  if (attribute.provenance !== 'inferred' && attribute.provenance !== 'suggested') return false
  if (attribute.confidence === null || attribute.confidence === undefined) return true
  return attribute.confidence <= HISTORICAL_CONFIDENCE_CEILING
}

export function assessGraphBackendMigration(db) {
  const relationshipCount = listRelationships(db).length
  const recommendGraphBackend = relationshipCount >= GRAPH_BACKEND_RELATIONSHIP_THRESHOLD
  return {
    relationshipCount,
    threshold: GRAPH_BACKEND_RELATIONSHIP_THRESHOLD,
    recommendGraphBackend,
    currentBackend: 'sqlite_fk',
    recommendedBackend: recommendGraphBackend ? 'graph_database' : 'sqlite_fk',
  }
}

export function assessLoraTrainingPipeline() {
  return {
    status: 'deferred',
    primaryStrategy: 'reference_image',
    escalationTrigger: 'continuity_qa_below_threshold',
    followUps: IPADAPTER_QWEN_DECISION.followUps,
  }
}

export function assertPostMvpCollaborationAllowed() {
  const err = new Error('Multi-user collaboration is deferred for v1; this workspace remains local-first.')
  err.status = 501
  err.code = 'POST_MVP_COLLABORATION_DEFERRED'
  throw err
}

export function resolveCloudInferenceRouting(env = process.env) {
  const cloudBaseUrl = typeof env.CLOUD_INFERENCE_BASE_URL === 'string'
    ? env.CLOUD_INFERENCE_BASE_URL.trim()
    : ''
  const stageModels = resolveStageModelConfig(env)
  return {
    mode: cloudBaseUrl ? 'hybrid' : 'local-first',
    cloudConfigured: Boolean(cloudBaseUrl),
    cloudBaseUrl: cloudBaseUrl || null,
    stageModels,
  }
}

export function assessVideoGeneration() {
  return {
    status: 'deferred',
    supportedOutputs: ['image'],
    deferredOutputs: ['video'],
  }
}

export function assessStandaloneLocationGeneration() {
  return {
    allowed: false,
    derivation: 'character_context',
    stage: 4,
    note: 'Environment entities are inferred from character canon and relationships in v1.',
  }
}

export function buildDeferredCapabilitiesReport(db, env = process.env) {
  return {
    epic: 'qwen-prompt-builder-54pd',
    capabilities: DEFERRED_P2_CAPABILITIES,
    assessments: {
      historicalFactChecking: {
        confidenceCeiling: HISTORICAL_CONFIDENCE_CEILING,
        stage: HISTORICAL_FACT_CHECK_STAGE,
      },
      graphBackend: assessGraphBackendMigration(db),
      loraTraining: assessLoraTrainingPipeline(),
      collaboration: {
        enabled: false,
        localFirst: true,
      },
      cloudInference: resolveCloudInferenceRouting(env),
      videoGeneration: assessVideoGeneration(),
      standaloneLocations: assessStandaloneLocationGeneration(),
    },
  }
}
