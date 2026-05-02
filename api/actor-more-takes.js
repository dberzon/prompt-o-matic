import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { assertPromptPackOperationAllowed } from './lib/prompts/access.js'
import { assertComfyOperationAllowed } from './lib/comfy/access.js'
import { createComfyService } from './lib/comfy/comfyService.js'
import { queueCharacterPortfolio } from './lib/portfolio/characterPortfolio.js'
import { getActorCandidate } from './lib/db/repositories.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertPromptPackOperationAllowed('compile-character', process.env)
    assertComfyOperationAllowed('queue', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const body = req.body || {}

    let characterId = body.characterId ?? null
    if (!characterId && body.actorCandidateId) {
      const candidate = getActorCandidate(runtime.db, body.actorCandidateId)
      if (!candidate) {
        return sendJsonNode(res, 404, { error: 'Actor candidate not found' })
      }
      try {
        const notesData = typeof candidate.notes === 'string' ? JSON.parse(candidate.notes) : candidate.notes
        characterId = notesData?.characterId ?? null
      } catch {
        return sendJsonNode(res, 422, { error: 'Actor candidate notes do not contain a characterId' })
      }
    }

    if (!characterId) {
      return sendJsonNode(res, 400, { error: 'characterId or actorCandidateId is required' })
    }

    const service = createComfyService({ env: process.env })
    const result = await queueCharacterPortfolio({
      db: runtime.db,
      comfyService: service,
      characterId,
      views: body.views,
      workflowId: body.workflowId,
      options: body.options || {},
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'ACTOR_MORE_TAKES_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
