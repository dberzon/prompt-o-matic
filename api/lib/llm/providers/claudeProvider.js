import { DEFAULT_ANTHROPIC_MODEL, envRead, parseAnthropicText } from './shared.js'

export async function claudeProvider({ userMessage, fetchImpl, env, systemPrompt }) {
  const apiKey = envRead(env, 'ANTHROPIC_API_KEY')
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY not configured')
    err.status = 500
    throw err
  }

  const model = envRead(env, 'ANTHROPIC_MODEL') || DEFAULT_ANTHROPIC_MODEL
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    const err = new Error(`Cloud upstream error: ${response.status}`)
    err.status = 502
    err.meta = errBody
    throw err
  }

  const data = await response.json()
  const text = parseAnthropicText(data)
  if (!text) {
    const err = new Error('Empty response from cloud provider')
    err.status = 502
    throw err
  }
  return text
}
