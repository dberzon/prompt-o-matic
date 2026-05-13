import { describe, expect, it, vi } from 'vitest'
import { sendJsonMiddleware } from '../lib/http.js'
import { qpbDevServer } from './index.js'

describe('qpbDevServer', () => {
  it('registers a middleware that serves discovered routes', async () => {
    /** @type {((req: unknown, res: unknown, next: () => void) => void | Promise<void>)[]} */
    const uses = []
    const server = {
      middlewares: {
        use: vi.fn((fn) => {
          uses.push(fn)
        }),
      },
    }

    const plugin = qpbDevServer({
      routes: [
        {
          routeKey: 'GET /api/__qpb_test_ping',
          method: 'GET',
          path: '/api/__qpb_test_ping',
          async handler(_req, res) {
            sendJsonMiddleware(res, 200, { ok: true, ping: 1 })
          },
        },
      ],
    })

    await /** @type {() => Promise<void>} */ (plugin.buildStart)()
    plugin.configureServer(server)

    expect(server.middlewares.use).toHaveBeenCalled()
    const layer = uses[0]
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(code, h) {
        this.statusCode = code
        Object.assign(this.headers, h)
      },
      end(body) {
        this.body = body
      },
    }
    const req = { method: 'GET', url: '/api/__qpb_test_ping' }
    let nextCalled = false
    await layer(req, res, () => {
      nextCalled = true
    })
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(String(res.body))).toEqual({ ok: true, ping: 1 })
  })
})
