import { describe, expect, it } from 'vitest'
import {
  isPortfolioBatchTerminalFailure,
  isPortfolioStatusItemSettled,
} from './castingPortfolioPoll.js'

describe('castingPortfolioPoll', () => {
  it('does not treat transient ok:false status probes as settled', () => {
    // Matches api/comfy-jobs-status.js catch path: ok:false, no status field.
    const item = {
      promptId: 'p1',
      promptPackId: 'pack-1',
      view: 'front_portrait',
      ok: false,
      error: 'ComfyUI timeout',
    }
    expect(isPortfolioStatusItemSettled(item, { retryCount: 0 })).toBe(false)
    expect(isPortfolioStatusItemSettled(item, { retryCount: 2 })).toBe(false)
    expect(isPortfolioBatchTerminalFailure([item])).toBe(false)
  })

  it('settles only on success or exhausted terminal failures', () => {
    expect(isPortfolioStatusItemSettled({ ok: true, status: 'success' }, {})).toBe(true)
    expect(isPortfolioStatusItemSettled({ ok: true, status: 'running' }, {})).toBe(false)
    expect(isPortfolioStatusItemSettled({ ok: true, status: 'unknown' }, {})).toBe(false)
    expect(isPortfolioStatusItemSettled({ ok: true, status: 'failed' }, { retryCount: 0 })).toBe(false)
    expect(isPortfolioStatusItemSettled({ ok: true, status: 'failed' }, { retryCount: 1 })).toBe(false)
    expect(isPortfolioStatusItemSettled({ ok: true, status: 'failed' }, { retryCount: 2 })).toBe(true)
  })

  it('marks portfolio_failed only when every item has terminal failed status', () => {
    expect(isPortfolioBatchTerminalFailure([
      { ok: true, status: 'failed' },
      { ok: true, status: 'failed' },
    ])).toBe(true)
    expect(isPortfolioBatchTerminalFailure([
      { ok: true, status: 'failed' },
      { ok: true, status: 'success' },
    ])).toBe(false)
    expect(isPortfolioBatchTerminalFailure([
      { ok: false, error: 'timeout' },
      { ok: true, status: 'failed' },
    ])).toBe(false)
    expect(isPortfolioBatchTerminalFailure([])).toBe(false)
  })
})
