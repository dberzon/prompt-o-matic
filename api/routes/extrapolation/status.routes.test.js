import { afterEach, describe, expect, it } from 'vitest'
import {
  attachExtrapolationRunTracking,
  clearExtrapolationRunTrackingForTests,
} from '../../lib/extrapolation/extrapolationRunStore.js'
import { createProgressBus } from '../../lib/extrapolation/progress-bus.js'
import statusRoute from './status.route.js'

function createMockJsonReqRes(url) {
  const req = /** @type {import('http').IncomingMessage} */ ({
    method: 'GET',
    url,
  })
  let written = ''
  const res = /** @type {import('http').ServerResponse} */ ({
    headersSent: false,
    statusCode: 0,
    headers: /** @type {Record<string, string>} */ ({}),
    writeHead(code, headers) {
      this.statusCode = code
      if (headers) Object.assign(this.headers, headers)
      this.headersSent = true
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) written += String(chunk)
    },
  })
  return { req, res, getWritten: () => written }
}

afterEach(() => {
  clearExtrapolationRunTrackingForTests()
})

describe('GET /api/extrapolation/:runId/status', () => {
  it('returns 404 when run is not registered', async () => {
    const { req, res, getWritten } = createMockJsonReqRes('/api/extrapolation/missing/status')
    await statusRoute.handler(req, res)
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(getWritten())).toMatchObject({ error: expect.any(String) })
  })

  it('returns snapshot JSON when tracking exists', async () => {
    const bus = createProgressBus()
    const tr = attachExtrapolationRunTracking('run-z', bus)
    tr.setSuccess({ ok: true, entityId: 'e1', stages: [] })
    const { req, res, getWritten } = createMockJsonReqRes('/api/extrapolation/run-z/status')
    await statusRoute.handler(req, res)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(getWritten())
    expect(body.done).toBe(true)
    expect(body.result).toMatchObject({ ok: true })
    tr.dispose()
  })
})
