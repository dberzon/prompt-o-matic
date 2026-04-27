import { DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, envRead, parseOllamaText } from './shared.js'

export async function ollamaProvider({ userMessage, fetchImpl, env, systemPrompt }) {
  const baseUrl = (envRead(env, 'OLLAMA_BASE_URL') || DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
  const model = envRead(env, 'OLLAMA_MODEL') || DEFAULT_OLLAMA_MODEL
  const timeoutMs = Number.parseInt(envRead(env, 'OLLAMA_TIMEOUT_MS') || '45000', 10)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 45000)
  try {
    const response = await fetchImpl(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt: userMessage,
        stream: false,
        options: {
          temperature: 0.35,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errBody = await response.text()
      const err = new Error(`Local Ollama error: ${response.status}`)
      err.status = 502
      err.meta = errBody
      throw err
    }

    const data = await response.json()
    const text = parseOllamaText(data)
    if (!text) {
      const err = new Error('Empty response from local provider')
      err.status = 502
      throw err
    }
    return text
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Local Ollama request timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
