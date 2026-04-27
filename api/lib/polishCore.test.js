import { describe, expect, it, vi } from 'vitest'
import { healthCheck, runPolish } from './polishCore.js'

describe('runPolish', () => {
  it('uses cloud provider when requested', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/tags')) {
        return { ok: false, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'polished cloud prompt' }] }),
      }
    })

    const result = await runPolish({
      payload: {
        engine: 'cloud',
        fragments: ['a person', 'interior'],
      },
      fetchImpl,
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_PROVIDER: 'ollama',
      },
    })

    expect(result.provider).toBe('cloud')
    expect(result.polished).toContain('polished cloud prompt')
  })

  it('falls back to cloud in auto mode when local unavailable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/tags')) {
        throw new Error('offline')
      }
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'cloud fallback' }] }),
      }
    })

    const result = await runPolish({
      payload: {
        engine: 'auto',
        fragments: ['wide shot', 'fog'],
      },
      fetchImpl,
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_PROVIDER: 'ollama',
      },
    })

    expect(result.provider).toBe('cloud')
    expect(result.fallback).toBe('local-unavailable')
  })

  it('rejects when local-only mode is enabled and local is unavailable', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/tags')) {
        throw new Error('offline')
      }
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'should not reach cloud' }] }),
      }
    })

    await expect(runPolish({
      payload: {
        engine: 'auto',
        localOnly: true,
        fragments: ['rainy street'],
      },
      fetchImpl,
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        LLM_PROVIDER: 'ollama',
      },
    })).rejects.toThrow('Local provider requested but Ollama is unavailable')
  })

  it('uses embedded provider when explicitly selected', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/health')) {
        return { ok: true, json: async () => ({}) }
      }
      if (s.includes('/v1/chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'embedded polished output' } }],
          }),
        }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'embedded',
        fragments: ['city', 'night'],
        embeddedPort: 43211,
        embeddedSecret: 'secret',
      },
      fetchImpl,
      env: {},
    })

    expect(result.provider).toBe('embedded')
    expect(result.polished).toContain('embedded polished output')
  })

  it('uses LM Studio when local provider is configured to lmstudio', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      if (s.includes('/chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'lmstudio polished output' } }],
          }),
        }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'local',
        fragments: ['city', 'night'],
      },
      fetchImpl,
      env: {
        LLM_PROVIDER: 'lmstudio',
      },
    })

    expect(result.provider).toBe('local')
    expect(result.polished).toContain('lmstudio polished output')
  })

  it('uses mock provider in local mode when configured', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [] }) }
      }
      return { ok: false, text: async () => 'unexpected' }
    })

    const result = await runPolish({
      payload: {
        engine: 'local',
        fragments: ['city', 'night'],
        mockResponse: 'mocked local output',
      },
      fetchImpl,
      env: {
        LLM_PROVIDER: 'mock',
      },
    })

    expect(result.provider).toBe('local')
    expect(result.polished).toContain('mocked local output')
  })
})

describe('healthCheck', () => {
  it('reports Ollama and LM Studio as available when both probes succeed', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'qwen2.5:7b-instruct' }],
          }),
        }
      }
      if (s.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'qwen-local' }] }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })

    const result = await healthCheck({
      engine: 'local',
      fetchImpl,
      env: {
        OLLAMA_MODEL: 'qwen2.5:7b-instruct',
        LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1',
      },
    })

    expect(result.local.available).toBe(true)
    expect(result.local.installed).toBe(true)
    expect(result.lmstudio.available).toBe(true)
    expect(result.provider).toBe('local')
  })

  it('reports Ollama unavailable when tags probe fails', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        throw new Error('offline')
      }
      if (s.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })

    const result = await healthCheck({
      engine: 'cloud',
      fetchImpl,
      env: {
        OLLAMA_MODEL: 'qwen2.5:7b-instruct',
      },
    })

    expect(result.local.available).toBe(false)
  })

  it('reports LM Studio unavailable when models probe fails', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const s = String(url)
      if (s.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'qwen2.5:7b-instruct' }],
          }),
        }
      }
      if (s.includes('/models')) {
        throw new Error('lmstudio down')
      }
      return { ok: false, json: async () => ({}) }
    })

    const result = await healthCheck({
      engine: 'cloud',
      fetchImpl,
      env: {
        OLLAMA_MODEL: 'qwen2.5:7b-instruct',
        LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1',
      },
    })

    expect(result.lmstudio.available).toBe(false)
    expect(result.local.available).toBe(true)
  })
})
