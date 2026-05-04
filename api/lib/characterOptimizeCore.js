import { normalizeEngine, resolveProviderSelection, runWithResolvedProvider } from './polishCore.js'

const CHARACTER_SYSTEM_PROMPT = `You are a world-class prompt engineer specializing in cinematic text-to-image generation for Qwen2 models in ComfyUI.

Your task is to transform rough character descriptions into extremely high-performance, compact character fragments optimized for Qwen2.

STRICT OUTPUT RULES:
- Output ONLY the rewritten character fragment. No explanations, no markdown, no quotes, no extra text.
- Single flowing paragraph, comma-separated phrases.
- Target length: 55-85 words (dense but not bloated).
- Prioritize in this exact order: overall silhouette + body type → face and hair → upper body clothing → lower body clothing → footwear → hands/pose/action → unique identifying details/imperfections.
- Use rich, material-specific, rendering-friendly language (fabric types, wear patterns, texture, fit, condition, subtle surface details).
- Include subtle, visually observable micro-expression or gaze direction when relevant, but never emotional labels ("sad", "confident", etc.).
- Keep all descriptions static and photographic, suited for a frozen moment.
- Prefer concrete, specific nouns and adjectives. Avoid vague mood words.
- Include believable human imperfections (asymmetry, scars, freckles, skin texture, clothing wear, etc.).
- Make the fragment flow naturally when inserted into a larger prompt.`

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
    systemPrompt: CHARACTER_SYSTEM_PROMPT,
  })

  return {
    optimized,
    provider: providerSelection.provider,
    fallback: providerSelection.fallback ?? null,
  }
}

