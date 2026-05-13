import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearExtrapolationProgressRunsForTests,
  createProgressBus,
  getExtrapolationProgressRun,
  registerExtrapolationProgressRun,
  unregisterExtrapolationProgressRun,
} from './progress-bus.js'

afterEach(() => {
  clearExtrapolationProgressRunsForTests()
})

describe('createProgressBus', () => {
  it('fans out emits to multiple subscribers in order', () => {
    const bus = createProgressBus()
    const a = []
    const b = []
    const u1 = bus.subscribe((e) => a.push(e.type))
    const u2 = bus.subscribe((e) => b.push(e.type))
    bus.emit({ type: 'one', x: 1 })
    bus.emit({ type: 'two', x: 2 })
    u1()
    bus.emit({ type: 'three' })
    expect(a).toEqual(['one', 'two'])
    expect(b).toEqual(['one', 'two', 'three'])
    u2()
  })

  it('replays prior events in order when subscribing mid-run', () => {
    const bus = createProgressBus()
    bus.emit({ type: 'a' })
    bus.emit({ type: 'b' })
    const seen = []
    bus.subscribe((e) => seen.push(e.type))
    expect(seen).toEqual(['a', 'b'])
    bus.emit({ type: 'c' })
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('is idempotent on close()', () => {
    const bus = createProgressBus()
    bus.close()
    bus.close()
    expect(bus.closed).toBe(true)
    bus.emit({ type: 'x' })
    const seen = []
    bus.subscribe((e) => seen.push(e.type))
    expect(seen).toEqual([])
  })

  it('dedupes run:end', () => {
    const bus = createProgressBus()
    const types = []
    bus.subscribe((e) => types.push(e.type))
    bus.emit({ type: 'run:end', ok: true })
    bus.emit({ type: 'run:end', ok: true })
    expect(types.filter((t) => t === 'run:end').length).toBe(1)
  })

  it('register / get / unregister extrapolation run', () => {
    const bus = createProgressBus()
    registerExtrapolationProgressRun('run-1', bus)
    expect(getExtrapolationProgressRun('run-1')).toBe(bus)
    unregisterExtrapolationProgressRun('run-1')
    expect(getExtrapolationProgressRun('run-1')).toBeNull()
  })

  it('does not throw when a subscriber throws', () => {
    const bus = createProgressBus()
    bus.subscribe(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    bus.subscribe(good)
    expect(() => bus.emit({ type: 'ok' })).not.toThrow()
    expect(good).toHaveBeenCalled()
  })
})
