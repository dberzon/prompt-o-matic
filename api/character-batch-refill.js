import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { refillCharacterBatch } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { resolveProviderSelection, runWithResolvedProvider } from './lib/polishCore.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('batch-refill', process.env)
    const body = req.body || {}
    runtime = createVectorRuntime({ env: process.env })

    const llmGenerate = async ({ system, user, providerPayload }) => {
      const providerSelection = await resolveProviderSelection({
        engine: providerPayload?.engine,
        localOnly: false,
        fetchImpl: fetch,
        env: process.env,
        payload: providerPayload || {},
      })
      return runWithResolvedProvider({
        provider: providerSelection.provider,
        userMessage: user,
        payload: providerPayload || {},
        fetchImpl: fetch,
        env: process.env,
        systemPrompt: system,
      })
    }

    const result = await refillCharacterBatch({
      db: runtime.db,
      batchId: body.batchId,
      targetCount: body.targetCount,
      maxNewCandidates: body.maxNewCandidates,
      provider: body.provider,
      options: body.options,
      llmGenerate,
      vectorStore: runtime.vectorStore,
      embeddingProvider: runtime.embeddingProvider,
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_REFILL_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
