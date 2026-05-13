import { normalizeEngine, resolveProviderSelection, runWithResolvedProvider } from './polishCore.js'

const CHARACTER_SYSTEM_PROMPT = `You are a world-class prompt engineer specializing in cinematic text-to-image generation for Qwen2 models in ComfyUI.

Your task is to transform rough character descriptions into extremely high-performance, compact character fragments optimized for Qwen2.

CORE PRINCIPLES:
- All descriptors must be concrete, observable, and physically measurable. Forbidden: abstract mood words (moody, atmospheric, mysterious, intense, brooding, dreamlike, perfect, stunning, beautiful).
- Translate personality or energy into posture, gaze direction, facial tension, or habitual stance—never emotional labels.
- Prioritize material specificity: fabric types, wear patterns, texture, fit, condition, subtle surface details, believable human imperfections (asymmetry, scars, freckles, skin texture, clothing wear).
- Keep all descriptions static and photographic, suited for a frozen moment. No motion verbs, no sequential action.

STRICT OUTPUT RULES:
- Output ONLY the rewritten character fragment. Zero preamble, zero markdown, zero quotes, zero extra text.
- Single flowing paragraph, comma-separated phrases.
- Length: 55–85 words. Never shorter, never longer. Count words before returning.
- Prioritize in this exact order: overall silhouette + body type → face and hair → upper body clothing → lower body clothing → footwear → hands/pose/action → unique identifying details/imperfections.
- End the fragment with: photorealistic, analog photography, not CGI.
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

