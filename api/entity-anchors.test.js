import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import entityAnchorsHandler from './entity-anchors.js'
import { createEntity, listVisualAnchors } from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'

const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-entity-anchor-route-test-'))
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
  delete process.env.SQLITE_DB_PATH
  delete process.env.APP_MODE
})

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

describe('entity anchors routes', () => {
  it('creates, lists, sets primary, and deletes anchors for an entity', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'Ruslan' })

    const createRes = mockRes()
    await entityAnchorsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/anchors',
      body: {
        id: 'anchor_route_1',
        type: 'reference_image',
        payload: PNG_BYTES,
        isPrimary: true,
      },
    }, createRes)
    expect(createRes.statusCode).toBe(200)
    expect(createRes.payload.item.isPrimary).toBe(true)
    expect(createRes.payload.item.payloadEncoding).toBe('base64')

    const listRes = mockRes()
    await entityAnchorsHandler({ method: 'GET', url: '/api/entities/ent_a/anchors' }, listRes)
    expect(listRes.payload.items.map((item) => item.id)).toEqual(['anchor_route_1'])

    const secondRes = mockRes()
    await entityAnchorsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/anchors',
      body: { id: 'anchor_route_2', type: 'seed', payload: '42' },
    }, secondRes)

    const primaryRes = mockRes()
    await entityAnchorsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/anchors/anchor_route_2/set-primary',
    }, primaryRes)
    expect(primaryRes.payload.item.id).toBe('anchor_route_2')
    expect(primaryRes.payload.item.isPrimary).toBe(true)

    const deleteRes = mockRes()
    await entityAnchorsHandler({ method: 'DELETE', url: '/api/entities/ent_a/anchors/anchor_route_1' }, deleteRes)
    expect(deleteRes.payload.deleted).toBe(true)
    expect(listVisualAnchors(db, { entityId: 'ent_a' }).map((item) => item.id)).toEqual(['anchor_route_2'])
  })

  it('accepts multipart uploads for reference_image anchors and promotes uploaded image', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'Ruslan' })

    await entityAnchorsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/anchors',
      body: {
        id: 'anchor_existing',
        type: 'reference_image',
        payload: PNG_BYTES,
        isPrimary: true,
      },
    }, mockRes())

    const boundary = '----anchor-test'
    const rawBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n`
        + 'Content-Disposition: form-data; name="type"\r\n\r\n'
        + 'reference_image\r\n'
        + `--${boundary}\r\n`
        + 'Content-Disposition: form-data; name="file"; filename="ref.png"\r\n'
        + 'Content-Type: image/png\r\n\r\n',
      ),
      PNG_BYTES,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])

    const createRes = mockRes()
    await entityAnchorsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/anchors',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      rawBody,
    }, createRes)
    expect(createRes.statusCode).toBe(200)
    expect(createRes.payload.item.type).toBe('reference_image')
    expect(createRes.payload.item.isPrimary).toBe(true)
    expect(Buffer.from(createRes.payload.item.payload, 'base64')).toEqual(PNG_BYTES)
    expect(listVisualAnchors(db, { entityId: 'ent_a' }).filter((item) => item.isPrimary)).toHaveLength(1)
  })

  it('rejects invalid reference image uploads', async () => {
    const dbPath = createTempDbPath()
    process.env.SQLITE_DB_PATH = dbPath
    process.env.APP_MODE = 'local-studio'
    const db = ensureDb(dbPath)
    createEntity(db, { id: 'ent_a', type: 'character', name: 'Ruslan' })

    const createRes = mockRes()
    await entityAnchorsHandler({
      method: 'POST',
      url: '/api/entities/ent_a/anchors',
      body: {
        type: 'reference_image',
        payload: Buffer.from('not-an-image'),
      },
    }, createRes)
    expect(createRes.statusCode).toBe(400)
    expect(createRes.payload.error).toMatch(/Unsupported or invalid image format/)
  })
})
