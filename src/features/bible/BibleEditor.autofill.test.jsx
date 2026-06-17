/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BibleEditor from './BibleEditor.jsx'

vi.mock('../../lib/api/bibles.js', () => ({
  fetchBible: vi.fn(),
  fetchBibleCompleteness: vi.fn(),
  approveBibleSection: vi.fn(),
}))

vi.mock('../../lib/api/agentsAutofill.js', () => ({
  startAutofillBible: vi.fn(),
  cancelAutofillBible: vi.fn(),
}))

vi.mock('../../lib/api/entityAttributes.js', () => ({
  listEntityAttributes: vi.fn(),
}))

import { cancelAutofillBible, startAutofillBible } from '../../lib/api/agentsAutofill.js'
import { fetchBible, fetchBibleCompleteness } from '../../lib/api/bibles.js'
import { listEntityAttributes } from '../../lib/api/entityAttributes.js'

const { lastEs } = vi.hoisted(() => ({
  lastEs: { current: /** @type {null | { listeners: Record<string, Array<(e: { data: string }) => void>> }} */ (null) },
}))

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

class MockEventSource {
  constructor(url) {
    this.url = typeof url === 'string' ? url : String(url)
    /** @type {Record<string, Array<(e: { data: string }) => void>>} */
    this.listeners = {}
    lastEs.current = this
  }

  /**
   * @param {string} name
   * @param {(e: { data: string }) => void} fn
   */
  addEventListener(name, fn) {
    (this.listeners[name] ??= []).push(fn)
  }

  close() {}
}

afterEach(() => {
  cleanup()
  lastEs.current = null
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** @returns {import('../../lib/api/bibles.js').CompletenessReport} */
function completenessReport() {
  return {
    ratio: 0.5,
    requiredCount: 4,
    recommendedCount: 4,
    presentRequired: 2,
    presentRecommended: 2,
    missingRequired: [],
    missingRecommended: [],
  }
}

const characterBible = {
  demographics: { gender: 'm', ageRange: '30s', eraLabel: '1990s' },
  physical: {
    height: 'tall',
    build: 'lean',
    face: 'angular',
    eyes: 'brown',
    nose: 'straight',
    lips: 'thin',
    skin: 'fair',
  },
  relationships: [],
  visuals: { portraitBrief: 'Test', continuityKeywords: [] },
}

describe('BibleEditor autofill', () => {
  it('drives toast through three iterations then shows terminationReason; refreshes bible data', async () => {
    vi.stubGlobal('EventSource', MockEventSource)

    const fetchMock = vi.fn()
    fetchMock.mockImplementation(async (url) => {
      const u = typeof url === 'string' ? url : String(url)
      if (u.includes('/api/extrapolation/autofill-run-test/status')) {
        return jsonResponse({
          runId: 'autofill-run-test',
          done: true,
          cancelled: false,
          result: {
            iterations: 3,
            gapsResolved: 2,
            gapsRemaining: 0,
            terminationReason: 'max-iterations',
          },
          error: null,
          events: [],
        })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    vi.mocked(fetchBible).mockResolvedValue({ bible: characterBible, provenance: {} })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })
    vi.mocked(startAutofillBible).mockResolvedValue({ runId: 'autofill-run-test' })

    render(<BibleEditor entityId="ent_autofill" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const completenessBefore = fetchBibleCompleteness.mock.calls.length
    const bibleBefore = fetchBible.mock.calls.length

    fireEvent.click(screen.getByTestId('T_BIBLE_AUTOFILL'))
    await waitFor(() => expect(startAutofillBible).toHaveBeenCalledWith('ent_autofill'))

    await waitFor(() => expect(lastEs.current).toBeTruthy())
    const es = /** @type {MockEventSource} */ (lastEs.current)

    await act(async () => {
      for (const n of [1, 2, 3]) {
        for (const fn of es.listeners['iter:start'] ?? []) {
          fn({
            data: JSON.stringify({
              type: 'iter:start',
              iteration: n,
              entityId: 'ent_autofill',
              gap: { field: 'description', suggestedStageId: 1 },
            }),
          })
        }
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('T_AUTOFILL_TOAST').textContent).toMatch(/iteration 3/)
    })

    await act(async () => {
      for (const fn of es.listeners['run:end'] ?? []) {
        fn({
          data: JSON.stringify({
            type: 'run:end',
            cancelled: false,
            terminationReason: 'max-iterations',
            iterations: 3,
            gapsResolved: 2,
            gapsRemaining: 0,
          }),
        })
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('T_AUTOFILL_TOAST').getAttribute('data-autofill-termination')).toBe(
        'max-iterations',
      )
    })

    await waitFor(() => {
      expect(fetchBibleCompleteness.mock.calls.length).toBeGreaterThan(completenessBefore)
      expect(fetchBible.mock.calls.length).toBeGreaterThan(bibleBefore)
    })
  })

  it('disables Auto-fill gaps while stream is active', async () => {
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url) => {
        const u = typeof url === 'string' ? url : String(url)
        if (u.includes('/api/extrapolation/autofill-run-test/status')) {
          return jsonResponse({
            runId: 'autofill-run-test',
            done: true,
            cancelled: false,
            result: { terminationReason: 'complete', iterations: 0, gapsResolved: 0, gapsRemaining: 0 },
            error: null,
            events: [],
          })
        }
        return jsonResponse({})
      }),
    )

    vi.mocked(fetchBible).mockResolvedValue({ bible: characterBible, provenance: {} })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })
    vi.mocked(startAutofillBible).mockResolvedValue({ runId: 'autofill-run-test' })

    render(<BibleEditor entityId="ent_autofill" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const btn = /** @type {HTMLButtonElement} */ (screen.getByTestId('T_BIBLE_AUTOFILL'))
    expect(btn.disabled).toBe(false)

    fireEvent.click(btn)
    await waitFor(() => expect(lastEs.current).toBeTruthy())

    await waitFor(() => expect(btn.disabled).toBe(true))

    await act(async () => {
      const es = /** @type {MockEventSource} */ (lastEs.current)
      for (const fn of es.listeners['run:end'] ?? []) {
        fn({
          data: JSON.stringify({
            type: 'run:end',
            cancelled: false,
            terminationReason: 'complete',
            iterations: 0,
            gapsResolved: 0,
            gapsRemaining: 0,
          }),
        })
      }
    })

    await waitFor(() => expect(btn.disabled).toBe(false))
  })

  it('ignores rapid re-clicks while autofill start is pending', async () => {
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url) => {
        const u = typeof url === 'string' ? url : String(url)
        if (u.includes('/api/extrapolation/autofill-run-test/status')) {
          return jsonResponse({
            runId: 'autofill-run-test',
            done: false,
            cancelled: false,
            result: null,
            error: null,
            events: [],
          })
        }
        return jsonResponse({})
      }),
    )

    vi.mocked(fetchBible).mockResolvedValue({ bible: characterBible, provenance: {} })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })
    let resolveStart
    vi.mocked(startAutofillBible).mockImplementation(
      () => new Promise((resolve) => {
        resolveStart = resolve
      }),
    )

    render(<BibleEditor entityId="ent_autofill" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    const btn = /** @type {HTMLButtonElement} */ (screen.getByTestId('T_BIBLE_AUTOFILL'))
    fireEvent.click(btn)
    fireEvent.click(btn)

    expect(btn.disabled).toBe(true)
    expect(startAutofillBible).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveStart({ runId: 'autofill-run-test' })
    })
  })

  it('cancels a live autofill run when the editor switches entities', async () => {
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url) => {
        const u = typeof url === 'string' ? url : String(url)
        if (u.includes('/api/extrapolation/autofill-run-test/status')) {
          return jsonResponse({
            runId: 'autofill-run-test',
            done: false,
            cancelled: false,
            result: null,
            error: null,
            events: [],
          })
        }
        return jsonResponse({})
      }),
    )

    vi.mocked(fetchBible).mockResolvedValue({ bible: characterBible, provenance: {} })
    vi.mocked(fetchBibleCompleteness).mockResolvedValue(completenessReport())
    vi.mocked(listEntityAttributes).mockResolvedValue({ items: [] })
    vi.mocked(startAutofillBible).mockResolvedValue({ runId: 'autofill-run-test' })
    vi.mocked(cancelAutofillBible).mockResolvedValue({
      ok: true,
      runId: 'autofill-run-test',
      cancelled: true,
    })

    const view = render(<BibleEditor entityId="ent_autofill" />)
    await waitFor(() => expect(screen.getByTestId('T_BIBLE_EDITOR')).toBeTruthy())

    fireEvent.click(screen.getByTestId('T_BIBLE_AUTOFILL'))
    await waitFor(() => expect(lastEs.current).toBeTruthy())

    view.rerender(<BibleEditor entityId="ent_other" />)

    await waitFor(() => {
      expect(cancelAutofillBible).toHaveBeenCalledWith('autofill-run-test')
    })
  })
})
