import { resolveStageModelId } from './modelRouting.js'
import { StageCache } from './stageCache.js'
import { buildStageSnapshot, extrapolationStages, getStageById } from './stages.js'

const MIDDLE_STAGE_IDS = [2, 3, 4, 5]

export function resolveParallelMiddleStages({ parallelMiddleStages, env = process.env } = {}) {
  if (parallelMiddleStages !== undefined) return Boolean(parallelMiddleStages)
  const raw = env?.EXTRAPOLATION_PARALLEL_STAGES_2_5
  return raw === '1' || String(raw).toLowerCase() === 'true'
}

export async function runExtrapolationStage({
  db,
  entityId,
  stageId,
  llm,
  cache = new StageCache(),
  prior = {},
  env = process.env,
}) {
  const stage = getStageById(stageId)
  if (!stage) {
    const err = new Error(`Unknown extrapolation stage: ${stageId}`)
    err.status = 400
    throw err
  }

  const modelId = resolveStageModelId(stageId, env)
  const snapshot = buildStageSnapshot(db, entityId)
  const cached = cache.get({ snapshot, stageId, modelId })
  if (cached?.result) {
    return {
      stageId,
      modelId,
      cacheHit: true,
      ...cached.result,
    }
  }

  const result = await stage.run({
    entityId,
    db,
    llm,
    modelId,
    cache,
    prior,
  })

  const payload = {
    writes: result.writes || [],
    suggestions: result.suggestions || [],
    conflicts: result.conflicts || [],
    raw: result.raw,
  }
  cache.set({ snapshot, stageId, modelId, result: payload })

  return {
    stageId,
    modelId,
    cacheHit: false,
    ...payload,
  }
}

async function recordStageResult({ prior, stages, onStageComplete }, result) {
  prior[result.stageId] = result
  stages.push(result)
  if (typeof onStageComplete === 'function') {
    await onStageComplete(result)
  }
}

export async function runExtrapolationPipeline({
  db,
  entityId,
  llm,
  cache = new StageCache(),
  env = process.env,
  onStageComplete,
  shouldCancel,
  parallelMiddleStages = resolveParallelMiddleStages({ env }),
}) {
  const prior = {}
  const stages = []
  const ctx = { prior, stages, onStageComplete }
  let middleStagesRan = false

  for (const stage of extrapolationStages) {
    if (typeof shouldCancel === 'function' && shouldCancel()) {
      return { cancelled: true, stages, prior }
    }

    if (parallelMiddleStages && MIDDLE_STAGE_IDS.includes(stage.id)) {
      if (middleStagesRan) continue
      middleStagesRan = true
      const middleResults = await Promise.all(MIDDLE_STAGE_IDS.map((stageId) => runExtrapolationStage({
        db,
        entityId,
        stageId,
        llm,
        cache,
        prior,
        env,
      })))
      for (const stageId of MIDDLE_STAGE_IDS) {
        const result = middleResults.find((item) => item.stageId === stageId)
        if (!result) {
          throw new Error(`Missing extrapolation stage result for stage ${stageId}`)
        }
        await recordStageResult(ctx, result)
      }
      continue
    }

    const result = await runExtrapolationStage({
      db,
      entityId,
      stageId: stage.id,
      llm,
      cache,
      prior,
      env,
    })
    await recordStageResult(ctx, result)
  }

  return { cancelled: false, stages, prior }
}
