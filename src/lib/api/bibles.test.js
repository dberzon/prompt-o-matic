import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  NotFoundError,
  approveBibleSection,
  fetchBible,
  fetchBibleCompleteness,
} from './bibles.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('bibles api', () => {
  it('fetchBible GETs encoded entity id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ bible: { a: 1 }, provenance: { p: 2 } }),
      })),
    )
    const out = await fetchBible('ent/x')
    expect(fetch).toHaveBeenCalledWith('/api/bibles/ent%2Fx', expect.objectContaining({ method: 'GET' }))
    expect(out).toEqual({ bible: { a: 1 }, provenance: { p: 2 } })
  })

  it('fetchBibleCompleteness GETs completeness URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ratio: 0.5,
          requiredCount: 2,
          recommendedCount: 2,
          presentRequired: 1,
          presentRecommended: 1,
          missingRequired: [{ section: 'demographics', field: 'gender' }],
          missingRecommended: [],
        }),
      })),
    )
    const report = await fetchBibleCompleteness('ent_1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/bibles/ent_1/completeness',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(report.ratio).toBe(0.5)
    expect(report.missingRequired).toHaveLength(1)
  })

  it('approveBibleSection POSTs section and optional note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      })),
    )
    await approveBibleSection('ent_a', 'demographics', 'looks good')
    expect(fetch).toHaveBeenCalledWith(
      '/api/bibles/ent_a/approve-section',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'demographics', note: 'looks good' }),
      }),
    )
  })

  it('approveBibleSection omits note when undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      })),
    )
    await approveBibleSection('ent_b', 'visuals')
    expect(fetch).toHaveBeenCalledWith(
      '/api/bibles/ent_b/approve-section',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ section: 'visuals' }),
      }),
    )
  })

  it('404 maps to NotFoundError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Entity not found', code: 'API_ERROR' }),
      })),
    )
    await expect(fetchBible('missing')).rejects.toSatisfy(
      (e) => e instanceof NotFoundError && e.status === 404 && e.message.includes('Entity'),
    )
  })

  it('network failure maps to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(fetchBibleCompleteness('ent_x')).rejects.toSatisfy(
      (e) => e instanceof ApiError && !(e instanceof NotFoundError) && e.message === 'Network request failed',
    )
  })

  it('non-404 HTTP error maps to ApiError with status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid request body', code: 'BAD' }),
      })),
    )
    await expect(approveBibleSection('ent_z', 'bad')).rejects.toSatisfy(
      (e) => e instanceof ApiError && e.status === 400 && !(e instanceof NotFoundError),
    )
  })
})
