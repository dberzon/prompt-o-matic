import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'

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
  try {
    assertComfyOperationAllowed('read-job', process.env)
    const body = req.body || {}
    const jobs = Array.isArray(body.jobs) ? body.jobs : []
    const service = createComfyService({ env: process.env })
    const items = []
    for (const job of jobs) {
      const promptId = typeof job?.promptId === 'string' ? job.promptId : ''
      const promptPackId = typeof job?.promptPackId === 'string' ? job.promptPackId : ''
      const view = typeof job?.view === 'string' ? job.view : 'other'
      if (!promptId) {
        items.push({ promptId: '', promptPackId, view, ok: false, error: 'Missing promptId' })
        continue
      }
      try {
        const raw = await service.getJobStatus(promptId)
        items.push({
          promptId,
          promptPackId,
          view,
          ok: true,
          status: classifyJobStatus(raw, promptId),
          raw,
        })
      } catch (error) {
        items.push({
          promptId,
          promptPackId,
          view,
          ok: false,
          error: error?.message || 'Status check failed',
        })
      }
    }
    const summary = {
      total: items.length,
      success: items.filter((x) => x.status === 'success').length,
      failed: items.filter((x) => x.status === 'failed' || x.ok === false).length,
      running: items.filter((x) => x.status === 'running').length,
      unknown: items.filter((x) => x.status === 'unknown').length,
    }
    return sendJsonNode(res, 200, { ok: true, items, summary })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_JOBS_STATUS_ERROR' })
  }
}

