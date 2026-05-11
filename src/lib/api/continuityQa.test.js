import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateContinuityQa,
  getContinuityQaScoringSheet,
  getMvpDoneGateReadiness,
  submitContinuityQaScores,
} from './continuityQa.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('continuity QA api', () => {
  it('loads MVP Done gate readiness', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, ready: false, checks: [] }),
    })))
    await getMvpDoneGateReadiness('ruslan_levashov')
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ruslan_levashov/mvp-done-gate',
      expect.any(Object),
    )
  })

  it('loads the blind scoring sheet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, scenes: [] }),
    })))
    await getContinuityQaScoringSheet('ruslan_levashov')
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ruslan_levashov/continuity-qa/scoring-sheet',
      expect.any(Object),
    )
  })

  it('queues continuity QA generations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, sceneCount: 5 }),
    })))
    await generateContinuityQa('ruslan_levashov', { queue: { dryRun: true } })
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ruslan_levashov/continuity-qa/generate',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('submits reviewer scores', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, outcome: 'accepted' }),
    })))
    await submitContinuityQaScores('ruslan_levashov', { scenes: [] })
    expect(fetch).toHaveBeenCalledWith(
      '/api/entities/ruslan_levashov/continuity-qa/scores',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
