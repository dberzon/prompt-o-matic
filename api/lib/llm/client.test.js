import { describe, expect, it, vi } from 'vitest'
import { createLlmClient } from './client.js'
import { createLlmGenerate } from '../extrapolation/llm.js'

describe('createLlmClient', () => {
  it('raw() matches createLlmGenerate() for identical mock-local input (parity)', async () => {
    const env = {
      ...process.env,
      LLM_PROVIDER: 'mock',
    }
    const fetchImpl = /** @type {typeof fetch} */ (vi.fn())
    const providerPayload = {
      engine: 'local',
      localProvider: 'mock',
      mockResponse: 'parity-ok',
    }
    const legacy = createLlmGenerate({ env, fetchImpl })
    const client = createLlmClient({ env, fetchImpl })
    const input = { system: 'sys', user: 'hello world', providerPayload }
    const a = await legacy(input)
    const b = await client.raw(input)
    expect(b).toBe(a)
    expect(b).toBe('parity-ok')
  })

  it('invokes telemetry.record exactly once per raw() call', async () => {
    const record = vi.fn()
    const env = {
      ...process.env,
      LLM_PROVIDER: 'mock',
    }
    const fetchImpl = /** @type {typeof fetch} */ (vi.fn())
    const client = createLlmClient({
      env,
      fetchImpl,
      telemetry: { record },
    })
    await client.raw({
      system: 's',
      user: 'u',
      providerPayload: { engine: 'local', localProvider: 'mock', mockResponse: 'x' },
    })
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0][0].kind).toBe('llm.raw')
  })
})
