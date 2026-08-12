/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  formatExtrapolationDropSummary,
  normalizeExtrapolationStages,
  useExtrapolation,
  waitForExtrapolationRunSettle,
} from './useExtrapolation.js'

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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('normalizeExtrapolationStages', () => {
  it('fills missing dropped with empty arrays and preserves known drops', () => {
    expect(
      normalizeExtrapolationStages([
        { stageId: 3, writes: [{ id: 'a' }], dropped: [{ key: null, reason: 'missing_attribute_key' }] },
        { stageId: 2, writes: [] },
      ]),
    ).toEqual([
      { stageId: 3, writes: [{ id: 'a' }], dropped: [{ key: null, reason: 'missing_attribute_key' }] },
      { stageId: 2, writes: [], dropped: [] },
    ])
  })
})

describe('formatExtrapolationDropSummary', () => {
  it('returns empty string when no drops', () => {
    expect(
      formatExtrapolationDropSummary([{ stageId: 1, writes: [{ x: 1 }], dropped: [] }]),
    ).toBe('')
  })

  it('matches AC-style copy for a single drop reason', () => {
    const line = formatExtrapolationDropSummary([
      { stageId: 3, writes: [{}, {}, {}], dropped: [{ key: null, reason: 'missing_attribute_key' }] },
    ])
    expect(line).toBe('3 attributes returned, 1 dropped (missing attribute key)')
  })
})

describe('waitForExtrapolationRunSettle', () => {
  it('returns true once status reports done', async () => {
    let calls = 0
    const apiGetFn = vi.fn(async () => {
      calls += 1
      return { done: calls >= 2 }
    })
    const ok = await waitForExtrapolationRunSettle('run_x', {
      attempts: 5,
      intervalMs: 1,
      apiGetFn,
    })
    expect(ok).toBe(true)
    expect(calls).toBeGreaterThanOrEqual(2)
  })
})

describe('useExtrapolation', () => {
  it('normalizes API payload so every stage has dropped[]', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        entityId: 'ent_1',
        cancelled: false,
        stages: [{ stageId: 1, writes: [], suggestions: [] }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useExtrapolation({ entityId: 'ent_1' }))
    await act(async () => {
      await result.current.run()
    })

    expect(result.current.error).toBe('')
    expect(result.current.result?.stages?.[0]?.dropped).toEqual([])
  })

  it('blocks a second run after cancel while the abandoned start request is still in flight', async () => {
    let resolveStart
    const startPromise = new Promise((resolve) => {
      resolveStart = resolve
    })
    const fetchMock = vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/api/extrapolate/character/')) {
        await startPromise
        return jsonResponse({ ok: true, runId: 'run_cancel_1' })
      }
      if (path.includes('/api/extrapolation/run_cancel_1/status')) {
        return jsonResponse({ ok: true, done: true, result: { stages: [] } })
      }
      return jsonResponse({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useExtrapolation({ entityId: 'ent_1' }))

    let runPromise
    await act(async () => {
      runPromise = result.current.run()
      await Promise.resolve()
    })
    expect(result.current.running).toBe(true)

    await act(async () => {
      result.current.cancel()
    })
    expect(result.current.running).toBe(false)
    expect(result.current.status).toBe('Cancelled')

    await act(async () => {
      const second = await result.current.run()
      expect(second).toBeNull()
    })
    // Start request still outstanding — only one extrapolate POST so far.
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/extrapolate/character/'))).toHaveLength(1)

    await act(async () => {
      resolveStart()
      await runPromise
    })
  })
})
