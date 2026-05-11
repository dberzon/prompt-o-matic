import { resolveStageModelId } from './modelRouting.js'
import { StageCache } from './stageCache.js'
import { buildStageSnapshot, extrapolationStages, getStageById } from './stages.js'

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

export async function runExtrapolationPipeline({
  db,
  entityId,
  llm,
  cache = new StageCache(),
  env = process.env,
  onStageComplete,
  shouldCancel,
}) {
  const prior = {}
  const stages = []

  for (const stage of extrapolationStages) {
    if (typeof shouldCancel === 'function' && shouldCancel()) {
      return { cancelled: true, stages, prior }
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
    prior[stage.id] = result
    stages.push(result)
    if (typeof onStageComplete === 'function') {
      await onStageComplete(result)
    }
  }

  return { cancelled: false, stages, prior }
}
