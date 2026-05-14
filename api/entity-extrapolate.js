import { randomUUID } from 'node:crypto'
import { createLlmGenerate } from './lib/extrapolation/llm.js'
import {
  attachExtrapolationRunTracking,
  scheduleDisposeExtrapolationRunTracking,
} from './lib/extrapolation/extrapolationRunStore.js'
import { runExtrapolationPipeline, runExtrapolationStage } from './lib/extrapolation/orchestrator.js'
import {
  createProgressBus,
  registerExtrapolationProgressRun,
  unregisterExtrapolationProgressRun,
} from './lib/extrapolation/progress-bus.js'
import { StageCache } from './lib/extrapolation/stageCache.js'
import { getEntity } from './lib/db/repositories.js'
import { normalizeHandlerError, readJsonBody, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'

function parseExtrapolateRoute(req) {
  const url = new URL(req.url || '', 'http://localhost')
  const characterMatch = url.pathname.match(/^\/api\/extrapolate\/character\/([^/]+)\/?$/)
  if (characterMatch) {
    return { mode: 'pipeline', entityId: decodeURIComponent(characterMatch[1]) }
  }
  const stageMatch = url.pathname.match(/^\/api\/extrapolate\/stage\/([^/]+)\/(\d+)\/?$/)
  if (stageMatch) {
    return {
      mode: 'stage',
      entityId: decodeURIComponent(stageMatch[1]),
      stageId: Number.parseInt(stageMatch[2], 10),
    }
  }
  const entityStageMatch = url.pathname.match(/^\/api\/entities\/([^/]+)\/extrapolate\/stage\/(\d+)\/?$/)
  if (entityStageMatch) {
    return {
      mode: 'stage',
      entityId: decodeURIComponent(entityStageMatch[1]),
      stageId: Number.parseInt(entityStageMatch[2], 10),
    }
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }

  const route = parseExtrapolateRoute(req)
  if (!route?.entityId) {
    return sendJsonNode(res, 400, { error: 'Missing entity id in path' })
  }

  let runtime = null
  try {
    const body = req.body !== undefined ? req.body : await readJsonBody(req)
    runtime = createVectorRuntime({ env: process.env })
    const db = runtime.db
    const entity = getEntity(db, route.entityId)
    if (!entity) return sendJsonNode(res, 404, { error: 'Entity not found' })

    const llm = body?.llm || createLlmGenerate({ env: process.env, fetchImpl: fetch })
    const cache = new StageCache()

    if (route.mode === 'stage') {
      const result = await runExtrapolationStage({
        db,
        entityId: route.entityId,
        stageId: route.stageId,
        llm,
        cache,
        prior: body?.prior || {},
        env: process.env,
      })
      return sendJsonNode(res, 200, { ok: true, entityId: route.entityId, ...result })
    }

    if (body?.stream === true) {
      const runId = randomUUID()
      const bus = createProgressBus()
      registerExtrapolationProgressRun(runId, bus)
      const tracking = attachExtrapolationRunTracking(runId, bus)

      const rt = runtime
      runtime = null

      sendJsonNode(res, 202, { ok: true, runId, entityId: route.entityId })

      void (async () => {
        try {
          const result = await runExtrapolationPipeline({
            db: rt.db,
            entityId: route.entityId,
            llm,
            cache,
            env: process.env,
            parallelMiddleStages: body?.parallelMiddleStages,
            progress: bus,
          })
          tracking.setSuccess({ ok: true, entityId: route.entityId, ...result })
        } catch (error) {
          const normalized = normalizeHandlerError(error)
          tracking.setThrown(normalized.message)
        } finally {
          try {
            unregisterExtrapolationProgressRun(runId)
          } catch {
            /* ignore */
          }
          try {
            bus.close()
          } catch {
            /* ignore */
          }
          try {
            rt.close()
          } catch {
            /* ignore */
          }
          scheduleDisposeExtrapolationRunTracking(runId, tracking, 120_000)
        }
      })()
      return
    }

    const result = await runExtrapolationPipeline({
      db,
      entityId: route.entityId,
      llm,
      cache,
      env: process.env,
      parallelMiddleStages: body?.parallelMiddleStages,
    })
    return sendJsonNode(res, 200, { ok: true, entityId: route.entityId, ...result })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, {
      error: normalized.message,
      code: error?.code || 'ENTITY_EXTRAPOLATE_ERROR',
    })
  } finally {
    runtime?.close?.()
  }
}
