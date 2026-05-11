import { resolveProviderSelection, runWithResolvedProvider } from '../polishCore.js'

export function createLlmGenerate({ env = process.env, fetchImpl = fetch } = {}) {
  return async function llmGenerate({ system, user, providerPayload = {} }) {
    const providerSelection = await resolveProviderSelection({
      engine: providerPayload.engine || 'auto',
      localOnly: false,
      fetchImpl,
      env,
      payload: providerPayload,
    })
    return runWithResolvedProvider({
      provider: providerSelection.provider,
      userMessage: user,
      payload: providerPayload,
      fetchImpl,
      env,
      systemPrompt: system,
    })
  }
}
