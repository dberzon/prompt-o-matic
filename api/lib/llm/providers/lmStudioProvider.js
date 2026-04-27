import { DEFAULT_LMSTUDIO_MODEL, DEFAULT_LMSTUDIO_URL, envRead } from './shared.js'

export async function lmStudioProvider({ userMessage, fetchImpl, env, systemPrompt }) {
  const baseUrl = (envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
  const model = envRead(env, 'LMSTUDIO_MODEL') || DEFAULT_LMSTUDIO_MODEL
  const timeoutMs = Number.parseInt(envRead(env, 'LMSTUDIO_TIMEOUT_MS') || '45000', 10)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 45000)
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
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
