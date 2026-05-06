import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import listHandler from '../../generated-images.js'
import approveHandler from '../../generated-image-approve.js'
import rejectHandler from '../../generated-image-reject.js'
import viewHandler from '../../generated-image-view.js'
import { resolveComfyImageInfo } from '../../generated-image-view.js'
import { createGeneratedImageRecord } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { validGeneratedImageRecord } from '../characters/fixtures.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-genimg-route-test-'))
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
  delete process.env.ENABLE_GENERATED_IMAGES_API
  delete process.env.APP_MODE
})

describe('generated images routes', () => {
  it('lists generated images by character and prompt pack', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_GENERATED_IMAGES_API = 'true'
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'gen_route_1',
      characterId: 'char_route_a',
      promptPackId: 'pack_route_a',
    })
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'gen_route_2',
      characterId: 'char_route_b',
      promptPackId: 'pack_route_b',
    })
    const resA = mockRes()
    await listHandler({ method: 'GET', query: { characterId: 'char_route_a' } }, resA)
    expect(resA.statusCode).toBe(200)
    expect(resA.payload.items.map((x) => x.id)).toContain('gen_route_1')
    const resB = mockRes()
    await listHandler({ method: 'GET', query: { promptPackId: 'pack_route_b' } }, resB)
    expect(resB.payload.items.map((x) => x.id)).toContain('gen_route_2')
  })

  it('approves and rejects generated image', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.ENABLE_GENERATED_IMAGES_API = 'true'
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createGeneratedImageRecord(db, {
      ...validGeneratedImageRecord,
      id: 'gen_route_patch',
      promptPackId: 'pack_route_patch',
      approved: false,
    })
    const approveRes = mockRes()
    await approveHandler({ method: 'POST', body: { id: 'gen_route_patch' } }, approveRes)
    expect(approveRes.statusCode).toBe(200)
    expect(approveRes.payload.item.approved).toBe(true)
    const rejectRes = mockRes()
    await rejectHandler({ method: 'POST', body: { id: 'gen_route_patch', rejectedReason: 'bad anatomy' } }, rejectRes)
    expect(rejectRes.statusCode).toBe(200)
    expect(rejectRes.payload.item.approved).toBe(false)
    expect(rejectRes.payload.item.rejectedReason).toBe('bad anatomy')
  })

  it('resolveComfyImageInfo falls back to imagePath metadata', () => {
    const info = resolveComfyImageInfo({
      imagePath: 'sub/dir/image.png',
    })
    expect(info).toEqual({
      filename: 'image.png',
      subfolder: 'sub/dir',
      type: 'output',
    })
  })

  it('blocks proxy when flag unset in cloud mode', async () => {
    process.env.APP_MODE = 'cloud'
    const disabledRes = mockRes()
    await viewHandler({ method: 'GET', query: { id: 'any' } }, disabledRes)
    expect(disabledRes.statusCode).toBe(403)
    process.env.ENABLE_GENERATED_IMAGES_API = 'true'
    const cloudRes = mockRes()
    await viewHandler({ method: 'GET', query: { id: 'any' } }, cloudRes)
    expect(cloudRes.statusCode).toBe(403)
  })
})

