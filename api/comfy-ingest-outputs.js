import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { getPromptPack } from './lib/db/repositories.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertComfyOperationAllowed('ingest', process.env)
    const body = req.body || {}
    if (!body.promptId || !body.promptPackId) {
      return sendJsonNode(res, 400, { error: 'Missing promptId or promptPackId' })
    }
    runtime = createVectorRuntime({ env: process.env })
    const service = createComfyService({ env: process.env })
    const promptPack = getPromptPack(runtime.db, body.promptPackId)
    if (!promptPack) return sendJsonNode(res, 404, { error: 'Prompt pack not found' })
    const status = await service.getJobStatus(body.promptId)
    const created = service.ingestHistoryOutputs({
      db: runtime.db,
      promptId: body.promptId,
      promptPack,
      characterId: body.characterId || promptPack.characterId,
      viewType: body.viewType || 'other',
      workflowVersion: body.workflowVersion || promptPack.comfyWorkflowId || 'qwen-image-2512-default',
      historyPayload: status.history,
    })
    return sendJsonNode(res, 200, { ok: true, created: created.length, items: created })
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'COMFY_INGEST_OUTPUTS_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
