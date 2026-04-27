import { normalizeEngine, resolveProviderSelection, runWithResolvedProvider } from './polishCore.js'

const CHARACTER_SYSTEM_PROMPT = `You are an expert prompt-writing assistant for cinematic text-to-image workflows.

Your task is to rewrite a rough character description into a compact, concrete character fragment that can be embedded inside a larger scene prompt.

STRICT OUTPUT RULES:
- Output ONLY the rewritten character description. No preamble, no markdown, no quotes.
- Single paragraph, comma-separated descriptive phrases.
- Length: 40 to 80 words.
- Physical/material details only: clothing, fabric, wear/condition, posture, face, hands, notable carried object.
- Use passive, static phrasing suited to a frozen still image.
- No story, no backstory, no dialogue, no inner thoughts, no emotional labels.
- No camera terms, no lighting terms, no film stock terms.
- No names unless explicitly part of a visible tag/object.
- Prefer specific nouns/adjectives over abstract mood words.
- Keep it human and non-idealized, with believable imperfections.`

function buildCharacterUserMessage({ description }) {
  return [
    'Rewrite the following rough character description into one production-ready character fragment following all system rules.',
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

