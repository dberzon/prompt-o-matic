import { DEFAULT_LMSTUDIO_URL, envRead } from '../llm/providers/shared.js'

const DEFAULT_LMSTUDIO_EMBED_MODEL = 'nomic-embed-text-v1.5'

function resolveTimeoutMs(env) {
  const parsed = Number.parseInt(envRead(env, 'LMSTUDIO_TIMEOUT_MS') || '45000', 10)
  return Number.isFinite(parsed) ? parsed : 45000
}

export function createLmStudioEmbeddingProvider({ fetchImpl = fetch, env = process.env } = {}) {
  const baseUrl = String(envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
  const model = envRead(env, 'LMSTUDIO_EMBED_MODEL') || DEFAULT_LMSTUDIO_EMBED_MODEL

  async function embedText(text) {
    const timeoutMs = resolveTimeoutMs(env)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: text }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const errBody = await response.text()
        const err = new Error(`LM Studio embedding error: ${response.status}`)
        err.status = 502
        err.meta = errBody
        throw err
      }
      const data = await response.json()
      const vector = data?.data?.[0]?.embedding
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('LM Studio embedding response missing vector')
      }
      return vector
    } catch (error) {
      if (error?.name === 'AbortError') {
        const err = new Error('LM Studio embedding request timed out')
        err.status = 504
        throw err
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async function embedMany(texts) {
    const output = []
    for (const text of texts) {
      output.push(await embedText(text))
    }
    return output
  }

  return {
    embedText,
    embedMany,
    config: { baseUrl, model },
  }
}
