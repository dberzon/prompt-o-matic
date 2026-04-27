import { normalizeHandlerError, sendJsonNode } from './lib/http.js'
import { assertCharacterBatchOperationAllowed } from './lib/characters/access.js'
import { mutateBatchCandidate } from './lib/characters/batchReview.js'
import { createVectorRuntime } from './lib/vector/runtime.js'
import { resolveProviderSelection, runWithResolvedProvider } from './lib/polishCore.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJsonNode(res, 405, { error: 'Method not allowed' })
  }
  let runtime = null
  try {
    assertCharacterBatchOperationAllowed('candidate-mutate', process.env)
    runtime = createVectorRuntime({ env: process.env })
    const body = req.body || {}
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
    const result = await mutateBatchCandidate({
      db: runtime.db,
      candidateId: body.candidateId,
      reason: body.reason,
      mutationInstructions: body.mutationInstructions,
      provider: body.provider,
      llmGenerate,
      vectorStore: runtime.vectorStore,
      embeddingProvider: runtime.embeddingProvider,
    })
    return sendJsonNode(res, 200, result)
  } catch (error) {
    const normalized = normalizeHandlerError(error)
    return sendJsonNode(res, normalized.status, { error: normalized.message, code: error?.code || 'CHARACTER_BATCH_CANDIDATE_MUTATE_ERROR' })
  } finally {
    runtime?.close?.()
  }
}
