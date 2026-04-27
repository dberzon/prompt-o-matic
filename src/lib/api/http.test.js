import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from './http.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api http helper', () => {
  it('builds query string for GET', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    })))
    await apiGet('/api/example', { id: 'abc', empty: '' })
    expect(fetch).toHaveBeenCalledWith('/api/example?id=abc', expect.any(Object))
  })

  it('throws helpful 403 error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden', code: 'X' }),
    })))
    await expect(apiPost('/api/example', { a: 1 })).rejects.toThrow('Likely missing required ENABLE_* env flag')
  })
})

