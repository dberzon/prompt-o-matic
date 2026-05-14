/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useExtrapolationStream } from './useExtrapolationStream.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

describe('useExtrapolationStream', () => {
  it('closes EventSource on unmount', async () => {
    const closes = vi.fn()
    class Es {
      constructor() {
        this.listeners = {}
      }

      addEventListener() {}

      close() {
        closes()
      }
    }

    const es = new Es()
    function MockEventSource() {
      return es
    }
    vi.stubGlobal('EventSource', MockEventSource)

    const { unmount } = renderHook(() => useExtrapolationStream('r1'))
    await act(async () => {})
    unmount()
    expect(closes).toHaveBeenCalled()
  })

  it('transitions to done on run:end and loads result from status', async () => {
    class Es {
      constructor() {
        this.listeners = {}
      }

      addEventListener(name, fn) {
        (this.listeners[name] ??= []).push(fn)
      }

      close() {}
    }

    const es = new Es()
    function MockEventSource() {
      return es
    }
    vi.stubGlobal('EventSource', MockEventSource)

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(
      jsonResponse({
        runId: 'r2',
        done: true,
        cancelled: false,
        result: { ok: true, entityId: 'e1', stages: [{ stageId: 1, writes: [], dropped: [] }] },
        error: null,
        events: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useExtrapolationStream('r2'))
    await act(async () => {
      for (const fn of es.listeners['run:end'] || []) {
        fn({ data: JSON.stringify({ type: 'run:end', cancelled: false }) })
      }
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.status).toBe('done')
    expect(result.current.result?.stages?.[0]?.stageId).toBe(1)
  })

  it('uses polling when EventSource is unavailable', async () => {
    vi.stubGlobal('EventSource', undefined)
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'r3',
          done: false,
          cancelled: false,
          result: null,
          error: null,
          events: [{ type: 'stage:start', stageId: 1 }],
        }),
      )
      .mockResolvedValue(
        jsonResponse({
          runId: 'r3',
          done: true,
          cancelled: false,
          result: { ok: true, stages: [] },
          error: null,
          events: [],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useExtrapolationStream('r3'))
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.warning).toMatch(/status polling/i)
    expect(result.current.status === 'done' || result.current.status === 'poll-fallback').toBe(true)
    vi.useRealTimers()
  })
})
