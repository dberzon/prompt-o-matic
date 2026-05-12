import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComfyService } from '../comfy/comfyService.js'
import { parseIpAdapterEmbeddingPayload } from '../comfy/ipadapterEmbeddingCache.js'
import {
  createEntity,
  createVisualAnchor,
  listVisualAnchors,
  writeAttribute,
} from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { enqueueReferencePortraitRender } from './referencePortraitRender.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-ref-render-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function seedEntityWithDescriptor(db, entityId = 'ent_ref_render_1') {
  createEntity(db, { id: entityId, type: 'character', name: 'Ruslan' })
  writeAttribute(db, { entityId, key: 'eyes', value: 'small piggy eyes', provenance: 'canon' })
  writeAttribute(db, {
    entityId,
    key: 'visual.descriptor',
    value: 'frontal portrait, neutral expression, plain backdrop',
    provenance: 'inferred',
  })
  return entityId
}

function mockComfyFetch({ imageBytes = Buffer.from('png-bytes') } = {}) {
  let historyCalls = 0
  return vi.fn(async (url, init = {}) => {
    const target = String(url)
    if (target.endsWith('/prompt') && init.method === 'POST') {
      return { ok: true, json: async () => ({ prompt_id: 'prompt_ref_1', number: 1 }) }
    }
    if (target.endsWith('/queue')) {
      return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
    }
    if (target.includes('/history/prompt_ref_1')) {
      historyCalls += 1
      if (historyCalls < 2) {
        return { ok: true, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({
          prompt_ref_1: {
            status: { status_str: 'success' },
            outputs: {
              '9': { images: [{ filename: 'ref.png', subfolder: '', type: 'output' }] },
            },
          },
        }),
      }
    }
    if (target.includes('/view?')) {
      return { ok: true, arrayBuffer: async () => imageBytes }
    }
    return { ok: true, json: async () => ({}) }
  })
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
})

describe('reference portrait render', () => {
  it('queues a portrait pack, waits for Comfy, and persists a primary reference anchor', async () => {
    const db = createTempDb()
    const entityId = seedEntityWithDescriptor(db)
    const fetchImpl = mockComfyFetch()
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })

    const result = await enqueueReferencePortraitRender({
      db,
      entityId,
      comfyService,
      fetchImpl,
      input: {
        compile: { options: { persist: true } },
        pollIntervalMs: 1,
        timeoutMs: 5000,
      },
      sleep: async () => {},
    })

    expect(result.ok).toBe(true)
    expect(result.promptPackId).toBeTruthy()
    expect(result.promptId).toBe('prompt_ref_1')
    expect(result.anchor.type).toBe('reference_image')
    expect(result.anchor.isPrimary).toBe(true)
    expect(Buffer.isBuffer(result.anchor.payload)).toBe(true)
    expect(result.anchor.payload.toString()).toBe('png-bytes')

    const anchors = listVisualAnchors(db, { entityId, type: 'reference_image' })
    expect(anchors).toHaveLength(1)
    expect(anchors[0].isPrimary).toBe(true)

    const embeddingAnchors = listVisualAnchors(db, { entityId, type: 'ipadapter_embedding' })
    expect(embeddingAnchors).toHaveLength(1)
    expect(result.ipadapterEmbedding?.clipEmbedding?.length).toBeGreaterThan(0)
    expect(parseIpAdapterEmbeddingPayload(embeddingAnchors[0].payload)?.comfyImage).toBeUndefined()
  })

  it('demotes an existing primary anchor when a new render is persisted', async () => {
    const db = createTempDb()
    const entityId = seedEntityWithDescriptor(db, 'ent_ref_render_2')
    createVisualAnchor(db, {
      entityId,
      type: 'reference_image',
      payload: Buffer.from('old'),
      isPrimary: true,
    })
    const fetchImpl = mockComfyFetch({ imageBytes: Buffer.from('new') })
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })

    await enqueueReferencePortraitRender({
      db,
      entityId,
      comfyService,
      fetchImpl,
      input: { pollIntervalMs: 1, timeoutMs: 5000 },
      sleep: async () => {},
    })

    const anchors = listVisualAnchors(db, { entityId, type: 'reference_image' })
    expect(anchors).toHaveLength(2)
    expect(anchors.filter((anchor) => anchor.isPrimary)).toHaveLength(1)
    expect(anchors.find((anchor) => anchor.isPrimary).payload.toString()).toBe('new')
  })

  it('returns queue metadata without persisting an anchor in dry-run mode', async () => {
    const db = createTempDb()
    const entityId = seedEntityWithDescriptor(db, 'ent_ref_render_3')
    const fetchImpl = vi.fn()
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' },
    })

    const result = await enqueueReferencePortraitRender({
      db,
      entityId,
      comfyService,
      input: {
        compile: { options: { persist: false } },
        queue: { dryRun: true },
      },
    })

    expect(result.dryRun).toBe(true)
    expect(result.queue.dryRun).toBe(true)
    expect(listVisualAnchors(db, { entityId })).toHaveLength(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails when visual.descriptor is missing', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_ref_render_4', type: 'character', name: 'Ruslan' })
    writeAttribute(db, { entityId: 'ent_ref_render_4', key: 'eyes', value: 'green eyes', provenance: 'canon' })
    const comfyService = createComfyService({
      fetchImpl: vi.fn(),
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' },
    })

    await expect(enqueueReferencePortraitRender({
      db,
      entityId: 'ent_ref_render_4',
      comfyService,
    })).rejects.toThrow('Missing visual.descriptor attribute')
  })
})
