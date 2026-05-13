import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROUTE_SUFFIX = '.route.js'

export class DuplicateRouteError extends Error {
  /**
   * @param {string} routeKey
   * @param {string} fileA
   * @param {string} fileB
   */
  constructor(routeKey, fileA, fileB) {
    super(`Duplicate route registration for "${routeKey}": ${fileA} and ${fileB}`)
    this.name = 'DuplicateRouteError'
    this.routeKey = routeKey
    this.fileA = fileA
    this.fileB = fileB
  }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listRouteFilesRecursive(dir) {
  /** @type {string[]} */
  const out = []
  if (!fs.existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name)
      if (ent.isDirectory()) {
        stack.push(full)
      } else if (ent.isFile() && ent.name.endsWith(ROUTE_SUFFIX)) {
        out.push(full)
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * @typedef {{
 *   routeKey: string
 *   method: string
 *   path?: string
 *   match?: (pathname: string) => boolean
 *   handler: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void | Promise<void>
 * }} RouteDescriptor
 */

/**
 * Discover route modules under `routesDir` (default `api/routes`).
 * Only `*.route.js` files are loaded; other extensions are ignored.
 *
 * @param {{ cwd?: string; routesDir?: string }} [opts]
 * @returns {Promise<RouteDescriptor[]>}
 */
export async function discoverRoutes({ cwd = process.cwd(), routesDir = 'api/routes' } = {}) {
  const root = path.isAbsolute(routesDir) ? routesDir : path.resolve(cwd, routesDir)
  const files = listRouteFilesRecursive(root)
  /** @type {Map<string, string>} */
  const routeKeyToFile = new Map()
  /** @type {RouteDescriptor[]} */
  const routes = []

  for (const absPath of files) {
    const href = pathToFileURL(absPath).href
    const mod = await import(href)
    const desc = mod.default
    if (!desc || typeof desc !== 'object') {
      throw new Error(`Route module must default-export a descriptor: ${absPath}`)
    }
    if (typeof desc.routeKey !== 'string' || !desc.routeKey.trim()) {
      throw new Error(`Route descriptor missing routeKey: ${absPath}`)
    }
    if (typeof desc.method !== 'string' || !desc.method.trim()) {
      throw new Error(`Route descriptor missing method: ${absPath}`)
    }
    if (typeof desc.handler !== 'function') {
      throw new Error(`Route descriptor missing handler: ${absPath}`)
    }
    if (!desc.path && typeof desc.match !== 'function') {
      throw new Error(`Route descriptor must set path or match(): ${absPath}`)
    }
    const key = desc.routeKey.trim()
    if (routeKeyToFile.has(key)) {
      throw new DuplicateRouteError(key, routeKeyToFile.get(key) || '', absPath)
    }
    routeKeyToFile.set(key, absPath)
    routes.push(/** @type {RouteDescriptor} */ (desc))
  }

  return routes
}
