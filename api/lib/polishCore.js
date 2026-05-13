import { claudeProvider } from './llm/providers/claudeProvider.js'
import { lmStudioProvider } from './llm/providers/lmStudioProvider.js'
import { mockProvider } from './llm/providers/mockProvider.js'
import { ollamaProvider } from './llm/providers/ollamaProvider.js'
import {
  DEFAULT_LMSTUDIO_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  envRead,
} from './llm/providers/shared.js'

const SYSTEM_PROMPT = `You are an expert prompt engineer specializing in high-fidelity text-to-image generation for the Qwen-Image 2512 model. Your task is to transform structured input fragments, stylistic cues, and optional narrative seeds into a single, optimized, cinematically precise prompt.

CORE PRINCIPLES:
- Translate all abstract concepts, emotions, or temporal cues into physical, material, and spatial descriptions.
- The environment must dominate the frame; human subjects are passive, absorbed, waiting, or unaware.
- Lighting must be physically explicit: specify direction, quality, diffusion, and source. Exactly one dominant light source.
- Composition must be explicitly stated using framing rules (perspective lines, subject placement, negative space, focal length).
- Integrate analog photography language naturally (film stock, grain structure, lens character, surface wear, color shift).

INPUT PROCESSING:
- If a director name, visual reference, or style tag is provided, extract its core compositional logic (e.g., symmetry, environmental immersion, high contrast, minimalist framing, architectural scale, color temperature, lens behavior) and apply it as a structural guide, not as a keyword.
- If a narrative beat, dialogue, psychology, or duration is provided, freeze it into a single static instant. Remove all motion, sound, and sequential logic. Retain only spatial relationships, object placement, and material state.
- Resolve conflicting inputs by prioritizing physical specificity and environmental presence over stylistic shorthand.

OUTPUT CONSTRAINTS:
- Output ONLY the final prompt. Zero preamble, zero markdown, zero explanations.
- Format: A single block of descriptive phrases separated by commas.
- Length: 65–105 words. Never shorter, never longer.
- Forbidden: Abstract mood words (moody, atmospheric, cinematic, dreamlike, perfect, stunning, beautiful, melancholic), action verbs implying motion, dialogue, or sequential events.
- Mandatory ending: Must conclude with anti-CGI anchors: photorealistic, shot on Kodak Vision3 5219 / Fuji Eterna 500T, analog photography, real worn surfaces, imperfect natural textures, not CGI, not digital illustration.
- The prompt must read as a cinematographer's shot note, not a parameter checklist.

STYLE TRANSLATION FRAMEWORK (APPLY UNIVERSALLY):
Map any stylistic input to these five parameters and synthesize them into the prompt:
1. Framing & Composition: perspective type, symmetry/asymmetry, subject placement, negative space ratio, lens focal length
2. Light & Atmosphere: single source direction, diffusion level, color temperature, shadow fall-off, atmospheric density
3. Material & Texture: surface wear, fabric/weathering state, architectural/organic details, tactile realism
4. Camera & Optics: depth of field, lens character, framing type, optical compression or expansion
5. Environmental Dominance: spatial scale relative to figures, landscape/interior presence, physical barriers or sightlines
Weave these into a unified, physically grounded description optimized for Qwen-Image 2512.`

function normalizeFrontPrefix(input) {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim().replace(/,+\s*$/, '')
  if (!trimmed) return ''
  return trimmed.slice(0, 40)
}

export function normalizeEngine(input) {
  if (input === 'cloud' || input === 'local' || input === 'embedded' || input === 'auto') return input
  return 'auto'
}

function buildUserMessage({ fragments, directorName, directorNote, scene, scenario, narrativeBeat }) {
  const directorContext = directorName
    ? `Director register: ${directorName}${directorNote ? ` - ${directorNote}` : ''}`
    : 'No specific director selected - apply general cinematic principles.'
  const sceneContext = scene ? `User's scene description (already partially expanded): "${scene}"` : ''
  const scenarioContext = scenario ? `Selected interaction scenario: "${scenario}"` : ''
  const narrativeContext = typeof narrativeBeat === 'string' && narrativeBeat.trim()
    ? `Narrative beat to translate into one static film-still (do not quote; distill to composition and materials only): "${narrativeBeat.trim()}"`
    : ''

  return [
    directorContext,
    sceneContext,
    scenarioContext,
    narrativeContext,
    `Assembled prompt fragments to polish:\n${fragments.join(', ')}`,
    'Rewrite these into a single unified cinematic prompt following all system instructions.',
  ].filter(Boolean).join('\n\n')
}

function normalizePolishedText(polished, frontPrefix) {
  const normalizedPrefix = normalizeFrontPrefix(frontPrefix)
  if (!normalizedPrefix) return polished
  return polished.toLowerCase().startsWith(normalizedPrefix.toLowerCase())
    ? polished
    : `${normalizedPrefix}, ${polished}`
}

async function embeddedProvider({ userMessage, fetchImpl, payload, systemPrompt = SYSTEM_PROMPT }) {
  const port = Number(payload?.embeddedPort)
  const secret = payload?.embeddedSecret
  const model = payload?.embeddedModel || 'qwen2.5-3b-instruct-q4_k_m'
  const timeoutMsRaw = Number.parseInt(payload?.embeddedTimeoutMs ?? envRead(undefined, 'EMBEDDED_TIMEOUT_MS') ?? '180000', 10)
  const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(15000, timeoutMsRaw) : 180000
  if (!port || !secret) {
    const err = new Error('Embedded runtime metadata missing')
    err.status = 400
    throw err
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-qpb-sidecar-secret': secret,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 220,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      const err = new Error(`Embedded upstream error: ${response.status}`)
      err.status = 502
      err.meta = text
      throw err
    }
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) {
      const err = new Error('Empty response from embedded provider')
      err.status = 502
      throw err
    }
    return text
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Embedded request timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function probeEmbedded(payload, fetchImpl) {
  const port = Number(payload?.embeddedPort)
  const secret = payload?.embeddedSecret
  if (!port || !secret) return false
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/health`, {
      headers: { 'x-qpb-sidecar-secret': secret },
    })
    return response.ok
  } catch {
    return false
  }
}

async function probeLmStudio(fetchImpl, env, payload = {}) {
  const baseUrl = String(payload?.lmStudioBaseUrl || envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
  const timeoutMs = Number.parseInt(envRead(env, 'LMSTUDIO_TIMEOUT_MS') || '8000', 10)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 8000)
  try {
    const response = await fetchImpl(`${baseUrl}/models`, {
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

async function probeOllama(fetchImpl, env) {
  const baseUrl = (envRead(env, 'OLLAMA_BASE_URL') || DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
  try {
    const response = await fetchImpl(`${baseUrl}/api/tags`)
    return response.ok
  } catch {
    return false
  }
}

function normalizeLocalProvider(input, env) {
  const raw = String(input || envRead(env, 'LLM_PROVIDER') || '').toLowerCase()
  if (raw === 'lmstudio' || raw === 'mock' || raw === 'ollama') return raw
  return 'ollama'
}

function normalizeLocalOnly(input) {
  return input === true || input === '1' || input === 'true'
}

export async function resolveProviderSelection({ engine, localOnly = false, fetchImpl, env, payload = {} }) {
  const normalizedEngine = normalizeEngine(engine)
  const strictLocalOnly = normalizeLocalOnly(localOnly)
  const localProvider = normalizeLocalProvider(payload?.localProvider, env)
  const defaultRaw = envRead(env, 'LLM_PROVIDER')
  const defaultProvider = defaultRaw === 'embedded' || defaultRaw === 'ollama' || defaultRaw === 'lmstudio' || defaultRaw === 'mock' ? 'local' : 'cloud'
  const selected = normalizedEngine === 'auto' ? defaultProvider : normalizedEngine

  if (strictLocalOnly && selected === 'cloud') {
    const err = new Error('Local-only mode is enabled. Switch engine to Auto or Local.')
    err.status = 400
    throw err
  }

  if (selected === 'embedded') {
    const ok = await probeEmbedded(payload, fetchImpl)
    if (!ok) {
      const err = new Error('Embedded provider requested but sidecar is unavailable')
      err.status = 503
      throw err
    }
    return { provider: 'embedded', resolvedFrom: normalizedEngine }
  }

  if (normalizedEngine === 'auto') {
    const embeddedOk = await probeEmbedded(payload, fetchImpl)
    if (embeddedOk) {
      return { provider: 'embedded', resolvedFrom: normalizedEngine }
    }
  }

  if (selected === 'local') {
    const isAvailable = localProvider === 'lmstudio'
      ? await probeLmStudio(fetchImpl, env, payload)
      : localProvider === 'mock'
        ? true
        : await probeOllama(fetchImpl, env)
    if (isAvailable) {
      return { provider: 'local', resolvedFrom: normalizedEngine }
    }
    if (normalizedEngine === 'local' || strictLocalOnly) {
      const err = new Error(
        localProvider === 'lmstudio'
          ? 'Local provider requested but LM Studio is unavailable'
          : 'Local provider requested but Ollama is unavailable'
      )
      err.status = 503
      throw err
    }
    return { provider: 'cloud', resolvedFrom: normalizedEngine, fallback: 'local-unavailable' }
  }
  return { provider: 'cloud', resolvedFrom: normalizedEngine }
}

export async function runWithResolvedProvider({
  provider,
  userMessage,
  payload = {},
  fetchImpl = fetch,
  env = process.env,
  systemPrompt = SYSTEM_PROMPT,
}) {
  if (provider === 'embedded') {
    return embeddedProvider({ userMessage, fetchImpl, payload, systemPrompt })
  }
  if (provider === 'local') {
    const configuredProvider = String(payload?.localProvider || envRead(env, 'LLM_PROVIDER') || '').toLowerCase()
    if (configuredProvider === 'lmstudio') {
      return lmStudioProvider({ userMessage, fetchImpl, env, payload, systemPrompt })
    }
    if (configuredProvider === 'mock') {
      return mockProvider({ userMessage, fetchImpl, env, payload, systemPrompt })
    }
    return ollamaProvider({ userMessage, fetchImpl, env, systemPrompt })
  }
  const configuredProvider = String(payload?.cloudProvider || envRead(env, 'LLM_CLOUD_PROVIDER') || '').toLowerCase()
  if (configuredProvider === 'mock') {
    return mockProvider({ userMessage, fetchImpl, env, payload, systemPrompt })
  }
  return claudeProvider({ userMessage, fetchImpl, env, systemPrompt })
}

export async function runPolish({
  payload,
  fetchImpl = fetch,
  env = process.env,
}) {
  if (!payload?.fragments || !Array.isArray(payload.fragments) || payload.fragments.length === 0) {
    const err = new Error('No prompt fragments provided')
    err.status = 400
    throw err
  }

  const userMessage = buildUserMessage(payload)
  const providerSelection = await resolveProviderSelection({
    engine: payload.engine,
    localOnly: payload.localOnly,
    fetchImpl,
    env,
    payload,
  })

  const polished = await runWithResolvedProvider({
    provider: providerSelection.provider,
    userMessage,
    payload,
    fetchImpl,
    env,
    systemPrompt: SYSTEM_PROMPT,
  })

  return {
    polished: normalizePolishedText(polished, payload.frontPrefix),
    provider: providerSelection.provider,
    engine: providerSelection.resolvedFrom,
    fallback: providerSelection.fallback ?? null,
  }
}

export async function healthCheck({
  engine = 'auto',
  localOnly = false,
  payload = {},
  fetchImpl = fetch,
  env = process.env,
}) {
  const providerSelection = await resolveProviderSelection({ engine, localOnly, fetchImpl, env, payload })
  const localProvider = normalizeLocalProvider(payload?.localProvider, env)
  const ollamaBaseUrl = (envRead(env, 'OLLAMA_BASE_URL') || DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
  const lmStudioBaseUrl = String(payload?.lmStudioBaseUrl || envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
  let local = { available: false, model: envRead(env, 'OLLAMA_MODEL') || DEFAULT_OLLAMA_MODEL }

  try {
    const tagsResp = await fetchImpl(`${ollamaBaseUrl}/api/tags`)
    if (tagsResp.ok) {
      const tags = await tagsResp.json()
      const list = Array.isArray(tags?.models) ? tags.models : []
      local = {
        available: true,
        model: envRead(env, 'OLLAMA_MODEL') || DEFAULT_OLLAMA_MODEL,
        installed: list.some((item) => item?.name === (envRead(env, 'OLLAMA_MODEL') || DEFAULT_OLLAMA_MODEL)),
      }
    }
  } catch {
    local = { ...local, available: false }
  }

  const embeddedAvailable = await probeEmbedded(payload, fetchImpl)
  const lmStudioAvailable = await probeLmStudio(fetchImpl, env, payload)

  if (localProvider === 'lmstudio') {
    local = {
      available: lmStudioAvailable,
      provider: 'lmstudio',
      baseUrl: lmStudioBaseUrl,
      model: payload?.lmStudioModel || envRead(env, 'LMSTUDIO_MODEL') || 'qwen-local',
    }
  } else if (localProvider === 'mock') {
    local = {
      available: true,
      provider: 'mock',
      model: payload?.mockResponse ? 'inline-mock' : 'mock',
    }
  } else {
    local = { ...local, provider: 'ollama', baseUrl: ollamaBaseUrl }
  }

  return {
    engine: normalizeEngine(engine),
    localOnly: normalizeLocalOnly(localOnly),
    provider: providerSelection.provider,
    fallback: providerSelection.fallback ?? null,
    local,
    lmstudio: {
      available: lmStudioAvailable,
      baseUrl: lmStudioBaseUrl,
    },
    embedded: {
      available: embeddedAvailable,
      ready: embeddedAvailable,
      modelId: payload?.embeddedModel ?? null,
      port: payload?.embeddedPort ?? null,
    },
  }
}
