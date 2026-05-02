import { DEFAULT_LMSTUDIO_MODEL, DEFAULT_LMSTUDIO_URL, envRead, stripThinkBlocks } from './shared.js'

export async function lmStudioProvider({ userMessage, fetchImpl, env, payload = {}, systemPrompt }) {
  const baseUrl = String(payload?.lmStudioBaseUrl || envRead(env, 'LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_URL).replace(/\/+$/, '')
  const model = payload?.lmStudioModel || envRead(env, 'LMSTUDIO_MODEL') || DEFAULT_LMSTUDIO_MODEL
  const timeoutMs = Number.parseInt(envRead(env, 'LMSTUDIO_TIMEOUT_MS') || '120000', 10)
  // Default 4000 — audition requests can produce 3+ character profiles × 15 fields each
  const maxTokens = Number.parseInt(envRead(env, 'LMSTUDIO_MAX_TOKENS') || '4000', 10)
  // Qwen3 thinking models use their entire token budget on reasoning and emit null content.
  // /no_think in the user message suppresses CoT for models that support the token.
  // enable_thinking:false is LM Studio's native suppression for Qwen3 (0.3+).
  // Disable both via LMSTUDIO_NO_THINK=false for non-Qwen models.
  const noThink = (envRead(env, 'LMSTUDIO_NO_THINK') ?? 'true') !== 'false'
  const userContent = noThink ? `/no_think\n${userMessage}` : userMessage

  // When the caller requests JSON output, enable LM Studio's structured JSON mode.
  // Newer LM Studio versions require json_schema instead of json_object.
  const wantJson = payload?.responseFormat === 'json'
  const responseFormat = wantJson
    ? { type: 'json_schema', json_schema: { name: 'output', schema: { type: 'object', additionalProperties: true }, strict: false } }
    : undefined

  const requestBody = {
    model,
    temperature: 0.35,
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4000,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    ...(responseFormat && { response_format: responseFormat }),
    // LM Studio 0.3+ native thinking suppression for Qwen3 models
    ...(noThink && { enable_thinking: false }),
  }

  const startMs = Date.now()
  console.error(`[lmstudio] → ${model} max_tokens=${requestBody.max_tokens} json=${wantJson} noThink=${noThink}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 120000)
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error(`[lmstudio] ✗ HTTP ${response.status} after ${Date.now() - startMs}ms:`, errBody.slice(0, 300))
      const err = new Error(`Local LM Studio error: ${response.status}`)
      err.status = 502
      err.meta = errBody
      throw err
    }

    const data = await response.json()
    const elapsed = Date.now() - startMs
    const finishReason = data?.choices?.[0]?.finish_reason
    const usage = data?.usage
    console.error(`[lmstudio] ✓ ${elapsed}ms finish=${finishReason} tokens=${usage?.completion_tokens ?? '?'}/${usage?.total_tokens ?? '?'}`)

    const text = stripThinkBlocks(data?.choices?.[0]?.message?.content?.trim() ?? '')
    if (!text) {
      console.error('[lmstudio] empty content, raw response:', JSON.stringify(data))
      const err = new Error('Empty response from local provider')
      err.status = 502
      throw err
    }
    return text
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.error(`[lmstudio] ✗ timed out after ${Date.now() - startMs}ms (limit ${timeoutMs}ms)`)
      const err = new Error('Local LM Studio request timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}