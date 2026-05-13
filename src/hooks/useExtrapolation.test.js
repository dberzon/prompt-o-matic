/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { formatExtrapolationDropSummary, normalizeExtrapolationStages, useExtrapolation } from './useExtrapolation.js'

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
})
