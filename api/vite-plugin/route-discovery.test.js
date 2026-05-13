import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverRoutes, DuplicateRouteError } from './route-discovery.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('discoverRoutes', () => {
  it('discovers only *.route.js files in stable path order', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-route-disc-'))
    tempDirs.push(root)
    const routesDir = path.join(root, 'routes')
    fs.mkdirSync(path.join(routesDir, 'z'), { recursive: true })
    fs.mkdirSync(path.join(routesDir, 'a'), { recursive: true })
    fs.writeFileSync(
      path.join(routesDir, 'z', 'z.route.js'),
      `export default { routeKey: 'GET /z', method: 'GET', path: '/z', async handler() {} }`,
    )
    fs.writeFileSync(
      path.join(routesDir, 'a', 'a.route.js'),
      `export default { routeKey: 'GET /a', method: 'GET', path: '/a', async handler() {} }`,
    )
    fs.writeFileSync(path.join(routesDir, 'helper.js'), `export const x = 1`)

    const routes = await discoverRoutes({ cwd: root, routesDir: 'routes' })
    expect(routes).toHaveLength(2)
    expect(routes.map((r) => r.routeKey)).toEqual(['GET /a', 'GET /z'])
  })

  it('throws DuplicateRouteError when two files share routeKey', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-route-dup-'))
    tempDirs.push(root)
    const routesDir = path.join(root, 'routes')
    fs.mkdirSync(routesDir, { recursive: true })
    const body =
      "export default { routeKey: 'GET /dup', method: 'GET', path: '/dup', async handler() {} }"
    fs.writeFileSync(path.join(routesDir, 'one.route.js'), body)
    fs.writeFileSync(path.join(routesDir, 'two.route.js'), body)

    await expect(discoverRoutes({ cwd: root, routesDir: 'routes' })).rejects.toBeInstanceOf(DuplicateRouteError)
  })

  it('returns empty array when routes directory is missing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-route-empty-'))
    tempDirs.push(root)
    const routes = await discoverRoutes({ cwd: root, routesDir: 'nope' })
    expect(routes).toEqual([])
  })
})
