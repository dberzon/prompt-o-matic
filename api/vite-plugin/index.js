import { normalizeHandlerError, sendJsonMiddleware } from '../lib/http.js'
import { discoverRoutes } from './route-discovery.js'

/**
 * @typedef {import('./route-discovery.js').RouteDescriptor} RouteDescriptor
 */

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv
 *   cwd?: string
 *   routesDir?: string
 *   routes?: RouteDescriptor[]
 * }} [opts]
 */
export function qpbDevServer(opts = {}) {
  const cwd = opts.cwd ?? process.cwd()
  const routesDir = opts.routesDir ?? 'api/routes'
  const routesPromise =
    opts.routes != null ? Promise.resolve(opts.routes) : discoverRoutes({ cwd, routesDir })

  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('./route-discovery.js').RouteDescriptor} route
   */
  function routeMatches(req, route) {
    if (String(req.method || '').toUpperCase() !== String(route.method || '').toUpperCase()) {
      return false
    }
    const pathname = new URL(req.url || '', 'http://localhost').pathname
    if (route.path != null && pathname === route.path) return true
    if (typeof route.match === 'function' && route.match(pathname)) return true
    return false
  }

  return {
    name: 'qpb-route-registry',
    apply: 'serve',
    buildStart() {
      return routesPromise.then(() => {})
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const routes = await routesPromise
        for (const route of routes) {
          if (!routeMatches(req, route)) continue
          try {
            await route.handler(req, res)
          } catch (err) {
            const normalized = normalizeHandlerError(err)
            sendJsonMiddleware(res, normalized.status, { error: normalized.message })
          }
          return
        }
        next()
      })
    },
  }
}
