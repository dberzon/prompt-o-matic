export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b-instruct'
export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'
export const DEFAULT_LMSTUDIO_MODEL = 'qwen-local'
export const DEFAULT_LMSTUDIO_URL = 'http://127.0.0.1:1234/v1'

export function envRead(env, key) {
  return env?.[key] ?? process.env[key]
}

export function resolveLmStudioBaseUrl(env, payload = {}) {
  const requested = typeof payload?.lmStudioBaseUrl === 'string'
    ? payload.lmStudioBaseUrl.trim()
    : ''
  const appMode = String(envRead(env, 'APP_MODE') || 'local-studio')
  if (appMode === 'cloud' && requested) {
    const err = new Error('Client-supplied LM Studio base URLs are disabled in cloud mode')
    err.status = 400
    throw err
  }
  return String(requested || envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
}

export function parseAnthropicText(data) {
  return data?.content?.[0]?.text?.trim() ?? ''
}

export function parseOllamaText(data) {
  if (typeof data?.response === 'string') return data.response.trim()
  if (typeof data?.message?.content === 'string') return data.message.content.trim()
  return ''
}


export function stripThinkBlocks(text) {
  if (typeof text !== 'string') return text
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}
