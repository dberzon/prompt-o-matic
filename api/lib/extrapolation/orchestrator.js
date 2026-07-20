import { getEntity } from '../db/repositories.js'
import { resolveStageModelId } from './modelRouting.js'
import { chainFor } from './stageRegistry.js'
import { StageCache } from './stageCache.js'
import { buildStageSnapshot } from './stages.js'

const MIDDLE_STAGE_IDS = [2, 3, 4, 5]

/**
 * @param {{ type?: string } | null | undefined} entity
 */
function entityChainType(entity) {
  return String(entity?.type || 'character').trim().toLowerCase()
}

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
  const entity = getEntity(db, entityId)
  const chain = chainFor(entityChainType(entity))
  const stage = chain.find((s) => s.id === stageId) || null
  if (!stage) {
    const err = new Error(`Unknown extrapolation stage: ${stageId}`)
    err.status = 400
    err.code = 'UNKNOWN_EXTRAPOLATION_STAGE'
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
    dropped: result.dropped || [],
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

/**
 * @param {{ prior: Record<number, unknown>, stages: unknown[], onStageComplete?: function, progress?: { emit?: (e: Record<string, unknown> & { type: string }) => void } }} ctx
 * @param {import('./types.js').StageRunResult & { stageId: number, modelId?: string, cacheHit?: boolean }} result
 */
async function recordStageResult(ctx, result) {
  const { prior, stages, onStageComplete, progress } = ctx
  prior[result.stageId] = result
  stages.push(result)
  if (progress && typeof progress.emit === 'function') {
    progress.emit({
      type: 'stage:finish',
      stageId: result.stageId,
      cacheHit: Boolean(result.cacheHit),
    })
  }
  if (typeof onStageComplete === 'function') {
    await onStageComplete(result)
  }
}

/**
 * @param {{ emit?: (e: Record<string, unknown> & { type: string }) => void } | null | undefined} progress
 * @param {Record<string, unknown> & { type: string }} event
 */
function emitProgress(progress, event) {
  if (progress && typeof progress.emit === 'function') progress.emit(event)
}

/**
 * @param {object} opts
 * @param {((r: import('./types.js').StageRunResult & { stageId: number, modelId?: string, cacheHit?: boolean }) => void | Promise<void>)=} opts.onStageComplete
 * @param {{ emit: (e: Record<string, unknown> & { type: string }) => void, close?: () => void }=} opts.progress SSE / in-process progress bus (optional)
 */
export async function runExtrapolationPipeline({
  db,
  entityId,
  llm,
  cache = new StageCache(),
  env = process.env,
  onStageComplete,
  shouldCancel,
  parallelMiddleStages = resolveParallelMiddleStages({ env }),
  progress,
}) {
  const entity = getEntity(db, entityId)
  const chain = chainFor(entityChainType(entity))
  const chainIds = new Set(chain.map((s) => s.id))
  const canParallelMiddle =
    Boolean(parallelMiddleStages) && MIDDLE_STAGE_IDS.every((id) => chainIds.has(id))

  const prior = {}
  const stages = []
  const ctx = { prior, stages, onStageComplete, progress }
  let middleStagesRan = false

  try {
    emitProgress(progress, { type: 'run:start', entityId })

    for (const stage of chain) {
      if (typeof shouldCancel === 'function' && shouldCancel()) {
        emitProgress(progress, { type: 'run:end', cancelled: true })
        return { cancelled: true, stages, prior }
      }

      if (canParallelMiddle && MIDDLE_STAGE_IDS.includes(stage.id)) {
        if (middleStagesRan) continue
        middleStagesRan = true
        // Stages 3-5 consume the immediately preceding stage through `prior`.
        // Keep accepting the legacy parallel option, but preserve that dependency
        // chain so context-free results are never persisted.
        for (const stageId of MIDDLE_STAGE_IDS) {
          emitProgress(progress, { type: 'stage:start', stageId })
          const result = await runExtrapolationStage({
            db,
            entityId,
            stageId,
            llm,
            cache,
            prior,
            env,
          })
          await recordStageResult(ctx, result)
        }
        continue
      }

      emitProgress(progress, { type: 'stage:start', stageId: stage.id })
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

    emitProgress(progress, { type: 'run:end', cancelled: false })
    return { cancelled: false, stages, prior }
  } catch (err) {
    emitProgress(progress, {
      type: 'run:error',
      message: err?.message || String(err),
      code: err?.code,
    })
    emitProgress(progress, { type: 'run:end', cancelled: false, error: true })
    throw err
  } finally {
    if (progress && typeof progress.close === 'function') {
      progress.close()
    }
  }
}

export { runExtrapolationStage as runStage }
