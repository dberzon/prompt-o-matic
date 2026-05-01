import { DEFAULT_LMSTUDIO_MODEL, DEFAULT_LMSTUDIO_URL, envRead } from './shared.js'

export async function lmStudioProvider({ userMessage, fetchImpl, env, payload = {}, systemPrompt }) {
  const baseUrl = String(payload?.lmStudioBaseUrl || envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
  const model = payload?.lmStudioModel || envRead(env, 'LMSTUDIO_MODEL') || DEFAULT_LMSTUDIO_MODEL
  const timeoutMs = Number.parseInt(envRead(env, 'LMSTUDIO_TIMEOUT_MS') || '120000', 10)
  const maxTokens = Number.parseInt(envRead(env, 'LMSTUDIO_MAX_TOKENS') || '2000', 10)
  // Qwen3 thinking models use their entire token budget on reasoning and emit null content.
  // /no_think suppresses the chain-of-thought. Disable via LMSTUDIO_NO_THINK=false for non-Qwen models.
  const noThink = (envRead(env, 'LMSTUDIO_NO_THINK') ?? 'true') !== 'false'
  const userContent = noThink ? `/no_think\n${userMessage}` : userMessage

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 120000)
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 2000,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errBody = await response.text()
      const err = new Error(`Local LM Studio error: ${response.status}`)
      err.status = 502
      err.meta = errBody
      throw err
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) {
      console.error('[lmstudio] empty content, raw response:', JSON.stringify(data))
      const err = new Error('Empty response from local provider')
      err.status = 502
      throw err
    }
    return text
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Local LM Studio request timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}