import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import entityExtrapolateStage5Handler from './entity-extrapolate-stage5.js'
import { createEntity, writeAttribute } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-stage5-route-test-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(obj) { this.payload = obj; return this },
    writeHead() {},
    end() {},
  }
}

afterEach(() => {
  while (openDbs.length > 0) {
    try {
      openDbs.pop().close()
    } catch {}
  }
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
  vi.restoreAllMocks()
  delete process.env.SQLITE_DB_PATH
  delete process.env.APP_MODE
  delete process.env.ENABLE_COMFY_API
  delete process.env.COMFYUI_BASE_URL
})

describe('entity extrapolate stage 5 route', () => {
  it('queues reference generation for a stage 5 descriptor', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    process.env.ENABLE_COMFY_API = 'true'
    process.env.COMFYUI_BASE_URL = 'http://127.0.0.1:8188'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_stage5_route', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
      entityId: 'ent_stage5_route',
      key: 'visual.descriptor',
      value: 'frontal portrait, neutral expression',
      provenance: 'inferred',
      sourceStage: 5,
    })

    let historyCalls = 0
    vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
      const target = String(url)
      if (target.endsWith('/prompt') && init.method === 'POST') {
        return { ok: true, json: async () => ({ prompt_id: 'prompt_route_1', number: 1 }) }
      }
      if (target.endsWith('/queue')) {
        return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
      }
      if (target.includes('/history/prompt_route_1')) {
        historyCalls += 1
        if (historyCalls < 2) {
          return { ok: true, json: async () => ({}) }
        }
        return {
          ok: true,
          json: async () => ({
            prompt_route_1: {
              status: { status_str: 'success' },
              outputs: {
                '9': { images: [{ filename: 'ref.png', subfolder: '', type: 'output' }] },
              },
            },
          }),
        }
      }
      if (target.includes('/view?')) {
        return { ok: true, arrayBuffer: async () => Buffer.from('png-bytes') }
      }
      return { ok: true, json: async () => ({}) }
    }))

    const res = mockRes()
    await entityExtrapolateStage5Handler({
      method: 'POST',
      url: '/api/entities/ent_stage5_route/extrapolate/stage/5',
      body: { pollIntervalMs: 1, timeoutMs: 5000 },
    }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.stage).toBe(5)
    expect(res.payload.feature).toBe('F_CONT_REFGEN')
    expect(res.payload.anchor.type).toBe('reference_image')
    expect(res.payload.anchor.payloadEncoding).toBe('base64')
  })
})
