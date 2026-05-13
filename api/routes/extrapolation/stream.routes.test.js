import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearExtrapolationProgressRunsForTests,
  createProgressBus,
  registerExtrapolationProgressRun,
} from '../../lib/extrapolation/progress-bus.js'
import streamRoute from './stream.route.js'

afterEach(() => {
  clearExtrapolationProgressRunsForTests()
  vi.useRealTimers()
})

/**
 * @param {string} raw
 * @returns {{ event: string, data: unknown }[]}
 */
function parseSseDataEvents(raw) {
  /** @type {{ event: string, data: unknown }[]} */
  const out = []
  const blocks = raw.split(/\n\n/).map((b) => b.trim()).filter(Boolean)
  for (const block of blocks) {
    if (block.startsWith(':') && !block.includes('\nevent:')) continue
    let eventName = 'message'
    const lines = block.split('\n')
    const dataLines = []
    for (const line of lines) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length) {
      const joined = dataLines.join('\n')
      try {
        out.push({ event: eventName, data: JSON.parse(joined) })
      } catch {
        out.push({ event: eventName, data: joined })
      }
    }
  }
  return out
}

function createMockSseReqRes(url) {
  /** @type {(() => void)[]} */
  const closeListeners = []
  const req = /** @type {import('http').IncomingMessage} */ ({
    method: 'GET',
    url,
    on(ev, fn) {
      if (ev === 'close') closeListeners.push(fn)
    },
  })

  let written = ''
  let ended = false
  const res = /** @type {import('http').ServerResponse} */ ({
    headersSent: false,
    statusCode: 0,
    headers: /** @type {Record<string, string>} */ ({}),
    writeHead(code, headers) {
      this.statusCode = code
      if (headers) Object.assign(this.headers, headers)
      this.headersSent = true
    },
    write(chunk) {
      written += String(chunk)
    },
    end(chunk) {
      if (ended) return
      ended = true
      if (chunk !== undefined && chunk !== null) written += String(chunk)
    },
  })

  return {
    req,
    res,
    getWritten: () => written,
    getEnded: () => ended,
    fireClose: () => closeListeners.forEach((fn) => fn()),
  }
}

describe('GET /api/extrapolation/:runId/stream', () => {
  it('returns 404 when run is not registered', async () => {
    const { req, res, getWritten } = createMockSseReqRes('/api/extrapolation/missing/stream')
    await streamRoute.handler(req, res)
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(getWritten())).toMatchObject({ error: expect.any(String) })
  })

  it('streams ordered events and ends after run:end (with mid-connect replay)', async () => {
    const bus = createProgressBus()
    registerExtrapolationProgressRun('run-a', bus)

    bus.emit({ type: 'stage:start', stageId: 1 })
    bus.emit({ type: 'stage:finish', stageId: 1, cacheHit: false })

    const { req, res, getWritten, fireClose } = createMockSseReqRes('/api/extrapolation/run-a/stream')
    await streamRoute.handler(req, res)

    expect(res.headers['Content-Type']).toBe('text/event-stream')

    bus.emit({ type: 'run:end', cancelled: false })
    await vi.waitFor(() => getWritten().includes('event: run:end'))

    const events = parseSseDataEvents(getWritten())
    const types = events.map((e) => e.event)
    expect(types).toContain('stage:start')
    expect(types.indexOf('stage:start')).toBeLessThan(types.indexOf('run:end'))
    expect(types.filter((t) => t === 'run:end').length).toBe(1)

    fireClose()
  })

  it('writes heartbeat comment every 15s until run:end', async () => {
    vi.useFakeTimers()
    const bus = createProgressBus()
    registerExtrapolationProgressRun('run-hb', bus)

    const { req, res, getWritten, getEnded } = createMockSseReqRes('/api/extrapolation/run-hb/stream')
    await streamRoute.handler(req, res)
    await vi.runOnlyPendingTimersAsync()
    expect(getWritten()).toMatch(/: stream connected/)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(getWritten()).toMatch(/: keepalive/)

    bus.emit({ type: 'run:end', ok: true })
    await vi.waitFor(() => getEnded())

    expect(getWritten().match(/: keepalive/g)?.length).toBeGreaterThanOrEqual(1)
  })
})
