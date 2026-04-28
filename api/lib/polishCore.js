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

const SYSTEM_PROMPT = `You are an expert prompt engineer for Qwen text-to-image
generation, with deep knowledge of cinematography, analog film photography, and
the visual language of art cinema directors including Tarkovsky, Kubrick, Lynch,
Jarmusch, Haneke, Antonioni, Bela Tarr, Wong Kar-wai, and others.

Your task is to take a set of structured prompt fragments and a director's
aesthetic signature, and rewrite them into a single, unified, cinematically
precise text-to-image prompt.

STRICT OUTPUT RULES:
- Output ONLY the final prompt. No preamble, no explanation, no markdown,
  no quotes, no "Here is your prompt:", nothing except the prompt itself.
- The prompt is a single block of comma-separated descriptive phrases.
- Total length: 60 to 110 words. Never shorter, never longer.
- Never use abstract mood words: not "moody", not "atmospheric", not
  "melancholic", not "cinematic" as a standalone word.
  Use physical, material, measurable descriptions only.
- Never describe action - only static composition and state.
  "standing in shallow water" yes. "walking toward the horizon" only if it
  describes a held moment, not motion.
- Figures must be passive - absorbed, waiting, unaware, not performing.
- One light source only. If the fragments contain conflicting light
  descriptions, choose the most cinematically specific one.
- Never idealize: no "beautiful", no "stunning", no "perfect".
- The environment must feel larger and more present than any human subject.
- Integrate film stock and grain language naturally - it should feel like
  it describes a real photograph, not a settings checklist.
- Always end with anti-CGI anchors: photorealistic, shot on film, analog
  photography, imperfect natural surfaces, not CGI, not illustrated.
- The final prompt must read as a coherent cinematographer's shot note,
  not a list of settings.

NARRATIVE BEAT (OPTIONAL):
If the user supplies a "narrative beat" or scene-seed description (dialogue,
psychology, duration, sound), do NOT output it literally. Translate it into
exactly one frozen instant: static composition and material state only, passive
figures, no sequential action, no dialogue, no sound-design language. Preserve
only spatial and physical truth (room type, distance between figures, light,
objects) implied by the beat.

DIRECTOR REGISTER:
The user will supply a director name and their one-line aesthetic signature.
Apply that director's specific compositional logic:
- Tarkovsky: figures absorbed into environment, silence as subject, one
  light source (usually natural), no dramatic gestures
- Kubrick: symmetry, one-point perspective, clinical distance, formal
  geometry - the space is more important than the person
- Lynch: ordinary surfaces concealing wrongness, light from impossible
  sources, the uncanny in domestic space
- Jarmusch: deadpan stillness, waiting without urgency, flat ambient light,
  figures in the wrong context with perfect composure
- Haneke: camera too far, holds too long, domestic space as threat,
  nothing announced
- Antonioni: alienation in beautiful locations, figures who cannot reach
  each other, modernist architecture as emotional landscape
- Bela Tarr: endurance as form, mud and wind, the camera following at
  walking pace, duration as the only content
- Wong Kar-wai: neon and motion blur, time as texture, longing
  materialized as color, proximity without contact
- Malick: magic hour light, bodies in grass and water, figures reaching
  upward, the camera from below looking up
- Villeneuve: epic scale revealing human smallness, obscured horizons,
  figures dwarfed by incomprehensible architecture
- Park Chan-wook: chess-piece precision, violence implied in stillness,
  every element of the frame pre-meditated
- Fincher: forensic control, teal and amber, institutional space,
  overhead surveillance, figures inside systems
- Eggers: period-authentic materials, extreme weather as moral condition,
  the supernatural visible in what the landscape does
- Leone: extreme close-up of hands and eyes, vast space between opponents,
  time stretched before action
- Parajanov: tableau vivant, frontal compositions, symbolic objects,
  allegory not psychology, folk art grammar
- For directors not listed above, apply the general aesthetic signature
  provided by the user.

WHAT MAKES A GOOD QWEN PROMPT:
1. Material specificity beats mood: "gray wool raincoat, collar turned up,
   dark with moisture at the shoulders" beats "a man in a raincoat"
2. Named film stocks anchor the grain and color: "Kodak Vision3 5219" or
   "Fuji Eterna 500T" are more effective than "film grain"
3. Composition stated explicitly: "figures at left third of frame, large
   negative space to the right" - models need this spelled out
4. Light described as a physical phenomenon: "flat overcast light, uniform
   gray sky, no cast shadows" not "soft lighting"
5. Anti-CGI language must be present and specific: "real worn surfaces,
   imperfect textures, non-idealized faces, not CGI, analog photography"
6. One dominant environment that is larger than its occupants`

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
