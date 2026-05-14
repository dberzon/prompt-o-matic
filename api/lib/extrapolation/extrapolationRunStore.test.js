import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProgressBus } from './progress-bus.js'
import {
  attachExtrapolationRunTracking,
  clearExtrapolationRunTrackingForTests,
  getExtrapolationRunTracking,
  scheduleDisposeExtrapolationRunTracking,
} from './extrapolationRunStore.js'

afterEach(() => {
  clearExtrapolationRunTrackingForTests()
  vi.useRealTimers()
})

describe('extrapolationRunStore', () => {
  it('records bus events and outcome for status polling', () => {
    const bus = createProgressBus()
    const tr = attachExtrapolationRunTracking('run-x', bus)
    bus.emit({ type: 'run:start', entityId: 'e1' })
    tr.setSuccess({ ok: true, stages: [] })
    const snap = tr.getSnapshot()
    expect(snap.settled).toBe(true)
    expect(snap.events.some((e) => e.type === 'run:start')).toBe(true)
    expect(snap.result).toMatchObject({ ok: true })
    const found = getExtrapolationRunTracking('run-x')
    expect(found).toBe(tr)
    tr.dispose()
    expect(getExtrapolationRunTracking('run-x')).toBeNull()
  })

  it('scheduleDisposeExtrapolationRunTracking removes tracking after delay', () => {
    vi.useFakeTimers()
    const bus = createProgressBus()
    const tr = attachExtrapolationRunTracking('run-y', bus)
    scheduleDisposeExtrapolationRunTracking('run-y', tr, 10_000)
    expect(getExtrapolationRunTracking('run-y')).toBe(tr)
    vi.advanceTimersByTime(10_000)
    expect(getExtrapolationRunTracking('run-y')).toBeNull()
  })
})
