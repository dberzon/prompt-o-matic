import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import jobsStatusHandler from '../../comfy-jobs-status.js'
import ingestManyHandler from '../../comfy-ingest-many.js'
import { createCharacter, createPromptPack, listGeneratedImageRecords } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { validCharacterProfile, validQwenImagePromptPack } from '../characters/fixtures.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-comfy-bulk-test-'))
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
  delete process.env.ENABLE_COMFY_API
  delete process.env.APP_MODE
  delete process.env.COMFYUI_BASE_URL
})

describe('comfy bulk endpoints', () => {
  it('bulk status returns partial results', async () => {
    process.env.ENABLE_COMFY_API = 'true'
    process.env.APP_MODE = 'local-studio'
    process.env.COMFYUI_BASE_URL = 'http://127.0.0.1:8188'
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/queue')) {
        return { ok: true, json: async () => ({ queue_running: [[0, 'running-id']], queue_pending: [] }) }
      }
      if (String(url).includes('/history/good-id')) {
        return { ok: true, json: async () => ({ 'good-id': { status: { status_str: 'success' }, outputs: {} } }) }
      }
      if (String(url).includes('/history/bad-id')) {
        throw new Error('history fetch failed')
      }
      return { ok: true, json: async () => ({}) }
    }))
    const res = mockRes()
    await jobsStatusHandler({
      method: 'POST',
      body: { jobs: [{ promptId: 'good-id', promptPackId: 'pack1', view: 'front_portrait' }, { promptId: 'bad-id', promptPackId: 'pack2', view: 'profile_portrait' }] },
    }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.items.length).toBe(2)
    expect(res.payload.items.some((x) => x.ok === true)).toBe(true)
    expect(res.payload.items.some((x) => x.ok === false)).toBe(true)
  })

  it('bulk ingest returns partial and creates records for successful jobs', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_COMFY_API = 'true'
    process.env.APP_MODE = 'local-studio'
    process.env.COMFYUI_BASE_URL = 'http://127.0.0.1:8188'
    const db = ensureDb(dbPath)
    createCharacter(db, { ...validCharacterProfile, id: 'char_bulk_ingest_1' })
    createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_bulk_ingest_1',
      characterId: 'char_bulk_ingest_1',
    })
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/queue')) {
        return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
      }
      if (String(url).includes('/history/good-ingest-id')) {
        return {
          ok: true,
          json: async () => ({
            'good-ingest-id': {
              status: { status_str: 'success' },
              outputs: { '9': { images: [{ filename: 'bulk.png', subfolder: '', type: 'output' }] } },
            },
          }),
        }
      }
      if (String(url).includes('/history/running-id')) {
        return { ok: true, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({}) }
    }))
    const res = mockRes()
    await ingestManyHandler({
      method: 'POST',
      body: {
        jobs: [
          { promptId: 'good-ingest-id', promptPackId: 'pack_bulk_ingest_1', characterId: 'char_bulk_ingest_1', workflowVersion: 'wf_v1', viewType: 'front_portrait' },
          { promptId: 'running-id', promptPackId: 'pack_bulk_ingest_1', characterId: 'char_bulk_ingest_1', workflowVersion: 'wf_v1', viewType: 'profile_portrait' },
        ],
      },
    }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.items.some((x) => x.ok === true)).toBe(true)
    expect(res.payload.items.some((x) => x.ok === false)).toBe(true)
    expect(listGeneratedImageRecords(db, { promptPackId: 'pack_bulk_ingest_1' }).length).toBeGreaterThan(0)
  })

  it('bulk endpoints respect comfy access guard in cloud mode', async () => {
    process.env.APP_MODE = 'cloud'
    const statusRes = mockRes()
    await jobsStatusHandler({ method: 'POST', body: { jobs: [] } }, statusRes)
    expect(statusRes.statusCode).toBe(403)
    const ingestRes = mockRes()
    await ingestManyHandler({ method: 'POST', body: { jobs: [] } }, ingestRes)
    expect(ingestRes.statusCode).toBe(403)
  })
})

