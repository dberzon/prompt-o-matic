import { getPrompt } from './prompts/registry.js'
import { renderPrompt } from './prompts/render.js'
import { normalizeEngine, resolveProviderSelection, runWithResolvedProvider } from './polishCore.js'

/** @type {string | null} */
let characterOptimizeV1RenderedCache = null

export function getCharacterOptimizeV1RenderedBody() {
  if (characterOptimizeV1RenderedCache == null) {
    const rec = getPrompt('characterOptimize')
    characterOptimizeV1RenderedCache = renderPrompt(rec.body, {})
  }
  return characterOptimizeV1RenderedCache
}

function buildCharacterUserMessage({ description }) {
  return [
    'Rewrite the following rough character description into a production-ready character fragment for Qwen2 following all system rules. Make it as visually dense and high-performance as possible.',
    `Input description: "${description.trim()}"`,
  ].join('\n\n')
}

export async function runCharacterOptimize({
  payload,
  fetchImpl = fetch,
  env = process.env,
}) {
  const description = typeof payload?.description === 'string' ? payload.description.trim() : ''
  if (!description) {
    const err = new Error('No character description provided')
    err.status = 400
    throw err
  }

  const providerSelection = await resolveProviderSelection({
    engine: normalizeEngine(payload.engine),
    localOnly: payload.localOnly,
    fetchImpl,
    env,
    payload,
  })

  const optimized = await runWithResolvedProvider({
    provider: providerSelection.provider,
    userMessage: buildCharacterUserMessage({ description }),
    payload,
    fetchImpl,
    env,
    systemPrompt: getCharacterOptimizeV1RenderedBody(),
  })

  return {
    optimized,
    provider: providerSelection.provider,
    fallback: providerSelection.fallback ?? null,
  }
}
