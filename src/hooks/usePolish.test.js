/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePolish } from './usePolish.js'

const baseInput = {
  fragments: ['cinematic medium shot', 'warm amber tone'],
  scene: 'a quiet street at dusk',
  scenario: null,
  directorName: null,
  directorNote: null,
  frontPrefix: '',
  narrativeBeat: null,
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: {
      get: (key) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function deferredFetch() {
  let resolveFn
  const promise = new Promise((resolve) => {
    resolveFn = resolve
  })
  const mock = vi.fn(() => promise)
  return { mock, resolve: (value) => resolveFn(value) }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('usePolish', () => {
  it('happy path: idle → loading → polished and captures debug response', async () => {
    const { mock, resolve } = deferredFetch()
    vi.stubGlobal('fetch', mock)

    const { result } = renderHook(() => usePolish())
    expect(result.current.state).toBe('idle')

    let polishPromise
    await act(async () => {
      polishPromise = result.current.polish(baseInput)
      await Promise.resolve()
    })
    expect(result.current.state).toBe('loading')
    expect(result.current.error).toBeNull()

    await act(async () => {
      resolve(jsonResponse({
        polished: 'polished cinematic prompt',
        provider: 'ollama',
        fallback: false,
        engine: 'local',
      }))
      await polishPromise
    })

    expect(result.current.state).toBe('polished')
    expect(result.current.polished).toBe('polished cinematic prompt')
    expect(result.current.error).toBeNull()
    expect(result.current.debug.lastResponse).toEqual({
      provider: 'ollama',
      fallback: false,
      engine: 'local',
    })
    expect(result.current.debug.lastRequest).toMatchObject({
      fragments: baseInput.fragments,
      scene: baseInput.scene,
      engine: 'auto',
      localOnly: false,
    })
    expect(mock).toHaveBeenCalledWith('/api/polish', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })

  it('HTTP error: idle → loading → error and surfaces API error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { error: 'provider unavailable' },
      { ok: false, status: 500 },
    )))

    const { result } = renderHook(() => usePolish())
    await act(async () => {
      await result.current.polish(baseInput)
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('provider unavailable')
    expect(result.current.polished).toBeNull()
    expect(result.current.debug.lastError).toBe('provider unavailable')
    expect(result.current.debug.lastRequest).toMatchObject({
      fragments: baseInput.fragments,
    })
  })

  it('non-JSON response: surfaces a non-JSON error without parsing JSON', async () => {
    const jsonSpy = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: jsonSpy,
      text: async () => '<html>not json</html>',
    })))

    const { result } = renderHook(() => usePolish())
    await act(async () => {
      await result.current.polish(baseInput)
    })

    expect(jsonSpy).not.toHaveBeenCalled()
    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Unexpected non-JSON response from API')
    expect(result.current.debug.lastError).toBe('Unexpected non-JSON response from API')
    expect(result.current.polished).toBeNull()
  })

  it('dry-run: skips fetch, sets dry-run state, populates lastRequest', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePolish())
    await act(async () => {
      await result.current.polish({ ...baseInput, dryRun: true })
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.state).toBe('dry-run')
    expect(result.current.polished).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.debug.lastRequest).toMatchObject({
      fragments: baseInput.fragments,
      scene: baseInput.scene,
    })
    expect(result.current.debug.lastResponse).toBeNull()
    expect(result.current.debug.lastError).toBeNull()
  })

  it('empty fragments: short-circuits, no fetch, state stays idle', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePolish())
    await act(async () => {
      await result.current.polish({ ...baseInput, fragments: [] })
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
    expect(result.current.polished).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.debug.lastRequest).toBeNull()
  })

  it('revert(): from polished, returns state to idle and clears polished/error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      polished: 'something',
      provider: null,
      fallback: null,
      engine: null,
    })))

    const { result } = renderHook(() => usePolish())
    await act(async () => {
      await result.current.polish(baseInput)
    })
    expect(result.current.state).toBe('polished')
    expect(result.current.polished).toBe('something')

    act(() => {
      result.current.revert()
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.polished).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
