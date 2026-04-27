import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { getPromptPack } from './lib/db/repositories.js'

function classifyJobStatus(raw, promptId) {
  const historyEntry = raw?.history?.[promptId]
  const statusStr = historyEntry?.status?.status_str
  if (statusStr === 'success') return 'success'
  if (statusStr === 'error') return 'failed'
  const running = Array.isArray(raw?.queue?.queue_running)
    ? raw.queue.queue_running.some((entry) => entry?.[1] === promptId)
    : false
  if (running) return 'running'
  return 'unknown'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertComfyOperationAllowed('ingest', process.env)
    const body = req.body || {}
    const jobs = Array.isArray(body.jobs) ? body.jobs : []
    runtime = createVectorRuntime({ env: process.env })
    const service = createComfyService({ env: process.env })
    const items = []
    for (const job of jobs) {
      const promptId = typeof job?.promptId === 'string' ? job.promptId : ''
      const promptPackId = typeof job?.promptPackId === 'string' ? job.promptPackId : ''
      if (!promptId || !promptPackId) {
        items.push({ promptId, promptPackId, ok: false, error: 'Missing promptId or promptPackId' })
        continue
      }
      try {
        const promptPack = getPromptPack(runtime.db, promptPackId)
        if (!promptPack) {
          items.push({ promptId, promptPackId, ok: false, error: 'Prompt pack not found' })
          continue
        }
        const statusRaw = await service.getJobStatus(promptId)
        const status = classifyJobStatus(statusRaw, promptId)
        if (status !== 'success') {
          items.push({ promptId, promptPackId, ok: false, status, error: 'Job not completed successfully' })
          continue
        }
        const created = service.ingestHistoryOutputs({
          db: runtime.db,
          promptId,
          promptPack,
          characterId: job.characterId || promptPack.characterId,
          viewType: job.viewType || 'other',
          workflowVersion: job.workflowVersion || promptPack.comfyWorkflowId || 'qwen-image-2512-default',
          historyPayload: statusRaw.history,
        })
        items.push({
          promptId,
          promptPackId,
          ok: true,
          created: created.length,
          records: created,
        })
      } catch (error) {
        items.push({ promptId, promptPackId, ok: false, error: error?.message || 'Ingest failed' })
      }
    }
    return sendJsonNode(res, 200, {
      ok: true,
      items,
      summary: {
        total: items.length,
        success: items.filter((x) => x.ok).length,
        failed: items.filter((x) => !x.ok).length,
        createdRecords: items.reduce((sum, x) => sum + (x.created || 0), 0),
      },
    })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_INGEST_MANY_ERROR' })
  } finally {
    runtime?.close?.()
  }
}

