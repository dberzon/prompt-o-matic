import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { runAutofillLoop } from '../../lib/agents/autofill-loop.js'
import { getEntity } from '../../lib/db/repositories.js'
import {
  attachExtrapolationRunTracking,
  scheduleDisposeExtrapolationRunTracking,
} from '../../lib/extrapolation/extrapolationRunStore.js'
import {
  createProgressBus,
  registerExtrapolationProgressRun,
  unregisterExtrapolationProgressRun,
} from '../../lib/extrapolation/progress-bus.js'
import { normalizeHandlerError, readJsonBody, sendJsonMiddleware } from '../../lib/http.js'
import { StageCache } from '../../lib/extrapolation/stageCache.js'
import { createLlmClient } from '../../lib/llm/client.js'
import { createVectorRuntime } from '../../lib/vector/runtime.js'
import { beginAutofillRun } from '../../lib/agents/autofillRunRegistry.js'

const bodySchema = z
  .object({
    entityId: z.string().min(1),
    maxIterations: z.number().int().nonnegative().optional(),
    budgetTokens: z.number().nonnegative().optional(),
  })
  .strict()

export default {
  routeKey: 'POST /api/agents/autofill-bible',
  method: 'POST',
  path: '/api/agents/autofill-bible',
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async handler(req, res) {
    if (req.method !== 'POST') {
      sendJsonMiddleware(res, 405, { error: 'Method not allowed' })
      return
    }

    let runtime = null
    try {
      const raw = req.body !== undefined ? req.body : await readJsonBody(req)
      const parsed = bodySchema.safeParse(raw)
      if (!parsed.success) {
        sendJsonMiddleware(res, 400, { error: 'Invalid request body', issues: parsed.error.issues })
        return
      }

      runtime = createVectorRuntime({ env: process.env })
      const db = runtime.db
      const entity = getEntity(db, parsed.data.entityId)
      if (!entity) {
        try {
          runtime.close()
        } catch {
          /* ignore */
        }
        sendJsonMiddleware(res, 404, { error: 'Entity not found' })
        return
      }

      const llm = createLlmClient({ env: process.env, fetchImpl: fetch }).raw
      const runId = randomUUID()
      const started = beginAutofillRun({ runId, entityId: parsed.data.entityId })
      if (!started.ok) {
        try {
          runtime.close()
        } catch {
          /* ignore */
        }
        sendJsonMiddleware(res, 409, {
          error: 'Autofill already running for this entity',
          runId: started.existingRunId,
        })
        return
      }
      const runRecord = started.record
      const bus = createProgressBus()
      registerExtrapolationProgressRun(runId, bus)
      const tracking = attachExtrapolationRunTracking(runId, bus)

      const maxIterations = parsed.data.maxIterations ?? 6
      const budgetTokens = parsed.data.budgetTokens

      const rt = runtime
      runtime = null

      sendJsonMiddleware(res, 202, { runId })

      setTimeout(() => {
        let cacheDir = null
        try {
          cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-autofill-stage-cache-'))
        } catch {
          cacheDir = null
        }
        const cache = cacheDir ? new StageCache({ cacheDir }) : new StageCache()
        void runAutofillLoop({
          db: rt.db,
          entityId: parsed.data.entityId,
          llm,
          maxIterations,
          budgetTokens,
          onEvent: (e) => bus.emit(e),
          env: process.env,
          cache,
          shouldCancel: () => runRecord.shouldCancel(),
        })
          .then((r) => {
            tracking.setSuccess(r)
          })
          .catch((err) => {
            console.error('[autofill-bible]', err?.message || err)
            bus.emit({
              type: 'run:error',
              message: err instanceof Error ? err.message : String(err),
            })
            bus.emit({ type: 'run:end', cancelled: false, error: true })
            tracking.setThrown(err instanceof Error ? err.message : String(err))
          })
          .finally(() => {
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
            runRecord.settle()
            if (cacheDir) {
              try {
                fs.rmSync(cacheDir, { recursive: true, force: true })
              } catch {
                /* ignore */
              }
            }
          })
      }, 15)
    } catch (err) {
      try {
        runtime?.close()
      } catch {
        /* ignore */
      }
      const normalized = normalizeHandlerError(err)
      sendJsonMiddleware(res, normalized.status, { error: normalized.message })
    }
  },
}
