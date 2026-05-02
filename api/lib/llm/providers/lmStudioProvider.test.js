import { describe, expect, it, vi } from 'vitest'
import { lmStudioProvider } from './lmStudioProvider.js'

const SYS = 'You are a prompt polisher.'
const USER = 'cinematic street scene, rain'

function makeOkFetch(content) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
    text: async () => '',
  }))
}

function captureBody(fetchImpl) {
  const calls = []
  const wrapped = vi.fn(async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts?.body ?? '{}') })
    return fetchImpl(url, opts)
  })
  wrapped.calls = calls
  return wrapped
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('lmStudioProvider — happy path', () => {
  it('returns trimmed content from choices[0].message.content', async () => {
    const fetchImpl = makeOkFetch('  polished cinematic output  ')
    const result = await lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS })
    expect(result).toBe('polished cinematic output')
  })

  it('hits /chat/completions on the configured base URL', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({
      userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1' }, systemPrompt: SYS,
    })
    expect(fetch.calls[0].url).toBe('http://127.0.0.1:1234/v1/chat/completions')
  })

  it('strips trailing slash from base URL', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({
      userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_BASE_URL: 'http://localhost:1234/v1///' }, systemPrompt: SYS,
    })
    expect(fetch.calls[0].url).toBe('http://localhost:1234/v1/chat/completions')
  })

  it('payload.lmStudioBaseUrl overrides env', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({
      userMessage: USER,
      fetchImpl: fetch,
      env: { LMSTUDIO_BASE_URL: 'http://wrong:9999/v1' },
      payload: { lmStudioBaseUrl: 'http://right:1234/v1' },
      systemPrompt: SYS,
    })
    expect(fetch.calls[0].url).toBe('http://right:1234/v1/chat/completions')
  })
})

// ---------------------------------------------------------------------------
// Request shape — stream, max_tokens, /no_think
// ---------------------------------------------------------------------------

describe('lmStudioProvider — request body', () => {
  it('always sends stream: false', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, systemPrompt: SYS })
    expect(fetch.calls[0].body.stream).toBe(false)
  })

  it('sends max_tokens: 4000 by default', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, systemPrompt: SYS })
    expect(fetch.calls[0].body.max_tokens).toBe(4000)
  })

  it('respects LMSTUDIO_MAX_TOKENS env var', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_MAX_TOKENS: '500' }, systemPrompt: SYS })
    expect(fetch.calls[0].body.max_tokens).toBe(500)
  })

  it('falls back to 4000 when LMSTUDIO_MAX_TOKENS is invalid', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_MAX_TOKENS: 'bad' }, systemPrompt: SYS })
    expect(fetch.calls[0].body.max_tokens).toBe(4000)
  })

  it('prefixes user message with /no_think by default', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, systemPrompt: SYS })
    const userMsg = fetch.calls[0].body.messages.find((m) => m.role === 'user')
    expect(userMsg.content).toBe(`/no_think\n${USER}`)
  })

  it('skips /no_think when LMSTUDIO_NO_THINK=false', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_NO_THINK: 'false' }, systemPrompt: SYS })
    const userMsg = fetch.calls[0].body.messages.find((m) => m.role === 'user')
    expect(userMsg.content).toBe(USER)
  })

  it('sends system prompt in messages[0]', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, systemPrompt: SYS })
    const sysMsg = fetch.calls[0].body.messages.find((m) => m.role === 'system')
    expect(sysMsg.content).toBe(SYS)
  })

  it('sends configured model name', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_MODEL: 'my-model' }, systemPrompt: SYS })
    expect(fetch.calls[0].body.model).toBe('my-model')
  })

  it('payload.lmStudioModel overrides env', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({
      userMessage: USER, fetchImpl: fetch,
      env: { LMSTUDIO_MODEL: 'env-model' },
      payload: { lmStudioModel: 'payload-model' },
      systemPrompt: SYS,
    })
    expect(fetch.calls[0].body.model).toBe('payload-model')
  })

  it('sends enable_thinking:false when noThink is true (default)', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, systemPrompt: SYS })
    expect(fetch.calls[0].body.enable_thinking).toBe(false)
  })

  it('omits enable_thinking when LMSTUDIO_NO_THINK=false', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: { LMSTUDIO_NO_THINK: 'false' }, systemPrompt: SYS })
    expect(fetch.calls[0].body.enable_thinking).toBeUndefined()
  })

  it('sends response_format json_object when payload.responseFormat=json', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, payload: { responseFormat: 'json' }, systemPrompt: SYS })
    expect(fetch.calls[0].body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'output', schema: { type: 'object', additionalProperties: true }, strict: false } })
  })

  it('omits response_format when payload.responseFormat is not json', async () => {
    const fetch = captureBody(makeOkFetch('ok'))
    await lmStudioProvider({ userMessage: USER, fetchImpl: fetch, env: {}, systemPrompt: SYS })
    expect(fetch.calls[0].body.response_format).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Empty / thinking-only responses (the failure mode we hit with Qwen3)
// ---------------------------------------------------------------------------

describe('lmStudioProvider — empty / thinking-only response', () => {
  async function runWithContent(content) {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, completion_tokens_details: { reasoning_tokens: 1418 } },
      }),
      text: async () => '',
    }))
    return lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS })
  }

  it('throws "Empty response from local provider" when content is null', async () => {
    await expect(runWithContent(null)).rejects.toMatchObject({
      message: 'Empty response from local provider',
      status: 502,
    })
  })

  it('throws "Empty response from local provider" when content is empty string', async () => {
    await expect(runWithContent('')).rejects.toMatchObject({
      message: 'Empty response from local provider',
      status: 502,
    })
  })

  it('throws "Empty response from local provider" when content is whitespace only', async () => {
    await expect(runWithContent('   \n\t  ')).rejects.toMatchObject({
      message: 'Empty response from local provider',
      status: 502,
    })
  })

  it('throws "Empty response from local provider" when choices array is empty', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [], usage: {} }),
      text: async () => '',
    }))
    await expect(lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS }))
      .rejects.toMatchObject({ message: 'Empty response from local provider', status: 502 })
  })

  it('throws "Empty response from local provider" when choices is missing entirely', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ usage: {} }),
      text: async () => '',
    }))
    await expect(lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS }))
      .rejects.toMatchObject({ message: 'Empty response from local provider', status: 502 })
  })
})

// ---------------------------------------------------------------------------
// Thinking-block stripping
// ---------------------------------------------------------------------------

describe('lmStudioProvider — think-block stripping', () => {
  it('strips a <think>...</think> block from the start of content', async () => {
    const fetchImpl = makeOkFetch('<think>\nsome reasoning here\n</think>\npolished cinematic output')
    const result = await lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS })
    expect(result).toBe('polished cinematic output')
  })

  it('strips multiple <think> blocks', async () => {
    const fetchImpl = makeOkFetch('<think>a</think> great <think>b</think> shot')
    const result = await lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS })
    expect(result).toBe('great  shot')
  })

  it('returns content unchanged when no think blocks present', async () => {
    const fetchImpl = makeOkFetch('clean polished output')
    const result = await lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS })
    expect(result).toBe('clean polished output')
  })

  it('throws "Empty response" when content is only a <think> block', async () => {
    const fetchImpl = makeOkFetch('<think>all reasoning, no output</think>')
    await expect(lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS }))
      .rejects.toMatchObject({ message: 'Empty response from local provider', status: 502 })
  })
})

// ---------------------------------------------------------------------------
// HTTP errors
// ---------------------------------------------------------------------------

describe('lmStudioProvider — HTTP errors', () => {
  it('throws with status 502 on non-ok HTTP response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }))
    await expect(lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS }))
      .rejects.toMatchObject({ message: 'Local LM Studio error: 500', status: 502 })
  })

  it('attaches response body to err.meta on HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'model not found',
    }))
    await expect(lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS }))
      .rejects.toMatchObject({ meta: 'model not found' })
  })
})

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('lmStudioProvider — timeout', () => {
  it('throws "Local LM Studio request timed out" on AbortError', async () => {
    const fetchImpl = vi.fn(async (_url, opts) => {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      opts.signal.addEventListener('abort', () => {})
      throw abortErr
    })
    await expect(
      lmStudioProvider({ userMessage: USER, fetchImpl, env: { LMSTUDIO_TIMEOUT_MS: '1' }, systemPrompt: SYS }),
    ).rejects.toMatchObject({ message: 'Local LM Studio request timed out', status: 504 })
  })

  it('re-throws non-abort errors unchanged', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    await expect(lmStudioProvider({ userMessage: USER, fetchImpl, env: {}, systemPrompt: SYS }))
      .rejects.toThrow('ECONNREFUSED')
  })
})
