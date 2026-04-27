const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_OLLAMA_EMBED_MODEL = 'nomic-embed-text'

function resolveTimeoutMs(env = process.env) {
  const parsed = Number.parseInt(env.OLLAMA_TIMEOUT_MS || '45000', 10)
  return Number.isFinite(parsed) ? parsed : 45000
}

function parseEmbeddingResponse(data) {
  if (Array.isArray(data?.embedding)) return data.embedding
  if (Array.isArray(data?.embeddings?.[0])) return data.embeddings[0]
  return null
}

export function createOllamaEmbeddingProvider({ fetchImpl = fetch, env = process.env } = {}) {
  const baseUrl = (env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '')
  const model = env.OLLAMA_EMBED_MODEL || DEFAULT_OLLAMA_EMBED_MODEL

  async function embedText(text) {
    const timeoutMs = resolveTimeoutMs(env)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const errBody = await response.text()
        const err = new Error(`Ollama embedding error: ${response.status}`)
        err.status = 502
        err.meta = errBody
        throw err
      }
      const data = await response.json()
      const vector = parseEmbeddingResponse(data)
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('Ollama embedding response missing vector')
      }
      return vector
    } catch (error) {
      if (error?.name === 'AbortError') {
        const err = new Error('Ollama embedding request timed out')
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
