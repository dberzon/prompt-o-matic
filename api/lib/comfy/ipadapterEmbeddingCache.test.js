import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEntity,
  createVisualAnchor,
  listVisualAnchors,
} from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import {
  comfyUploadFilenameForImageDigest,
  deriveClipVisionEmbeddingFromImage,
  ensureIpAdapterEmbeddingCache,
  imagePayloadDigest,
  parseIpAdapterEmbeddingPayload,
  resolveIpAdapterWorkflowImage,
  serializeIpAdapterEmbeddingPayload,
} from './ipadapterEmbeddingCache.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-ipadapter-cache-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
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
})

describe('ipadapter embedding cache', () => {
  it('derives a stable CLIP-shaped embedding from image bytes', () => {
    const bytes = Buffer.from('png-bytes')
    const first = deriveClipVisionEmbeddingFromImage(bytes)
    const second = deriveClipVisionEmbeddingFromImage(bytes)
    expect(first).toHaveLength(768)
    expect(second).toEqual(first)
    expect(first[0]).toBeGreaterThanOrEqual(0)
    expect(first[0]).toBeLessThanOrEqual(1)
  })

  it('persists a cached embedding and resolves the comfy filename on re-render', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_cache', type: 'character', name: 'Ruslan' })
    const reference = createVisualAnchor(db, {
      id: 'anchor_ref',
      entityId: 'ent_cache',
      type: 'reference_image',
      payload: Buffer.from('png-bytes'),
      isPrimary: true,
    })

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'uploaded-reference.png', subfolder: '', type: 'input' }),
    }))
    const cached = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_cache',
      comfyService: { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } },
      fetchImpl,
    })

    expect(cached?.sourceAnchorId).toBe(reference.id)
    expect(cached?.imageDigest).toBe(imagePayloadDigest(reference.payload))
    expect(cached?.comfyImage?.filename).toBe('uploaded-reference.png')
    expect(cached?.clipEmbedding).toHaveLength(768)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const embeddings = listVisualAnchors(db, { entityId: 'ent_cache', type: 'ipadapter_embedding' })
    expect(embeddings).toHaveLength(1)
    expect(parseIpAdapterEmbeddingPayload(embeddings[0].payload)?.comfyImage?.filename).toBe('uploaded-reference.png')

    const resolved = resolveIpAdapterWorkflowImage(db, 'ent_cache')
    expect(resolved?.kind).toBe('cached')
    expect(resolved?.filename).toBe('uploaded-reference.png')

    fetchImpl.mockClear()
    const reused = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_cache',
      comfyService: { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } },
      fetchImpl,
    })
    expect(reused?.comfyImage?.filename).toBe('uploaded-reference.png')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reuses an existing comfy filename without uploading when the anchor payload is already a filename', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_filename', type: 'character', name: 'Ruslan' })
    createVisualAnchor(db, {
      id: 'anchor_filename',
      entityId: 'ent_filename',
      type: 'reference_image',
      payload: 'reference-anchor.png',
      isPrimary: true,
    })

    const fetchImpl = vi.fn()
    const cached = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_filename',
      comfyService: { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } },
      fetchImpl,
      skipUpload: true,
    })

    expect(cached?.comfyImage?.filename).toBe('reference-anchor.png')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(resolveIpAdapterWorkflowImage(db, 'ent_filename')?.filename).toBe('reference-anchor.png')
  })

  it('uploads distinct Comfy filenames per image digest so entities cannot clobber each other', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_a', type: 'character', name: 'A' })
    createEntity(db, { id: 'ent_b', type: 'character', name: 'B' })
    const bytesA = Buffer.from('face-a-bytes')
    const bytesB = Buffer.from('face-b-bytes')
    createVisualAnchor(db, {
      id: 'anchor_a',
      entityId: 'ent_a',
      type: 'reference_image',
      payload: bytesA,
      isPrimary: true,
    })
    createVisualAnchor(db, {
      id: 'anchor_b',
      entityId: 'ent_b',
      type: 'reference_image',
      payload: bytesB,
      isPrimary: true,
    })

    const uploadedNames = []
    const fetchImpl = vi.fn(async (_url, init) => {
      const file = init.body.get('image')
      uploadedNames.push(file.name)
      return {
        ok: true,
        json: async () => ({ name: file.name, subfolder: '', type: 'input' }),
      }
    })
    const comfyService = { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } }

    const cachedA = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_a',
      comfyService,
      fetchImpl,
    })
    const cachedB = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_b',
      comfyService,
      fetchImpl,
    })

    const expectedA = comfyUploadFilenameForImageDigest(imagePayloadDigest(bytesA))
    const expectedB = comfyUploadFilenameForImageDigest(imagePayloadDigest(bytesB))
    expect(expectedA).not.toBe(expectedB)
    expect(cachedA?.comfyImage?.filename).toBe(expectedA)
    expect(cachedB?.comfyImage?.filename).toBe(expectedB)
    expect(uploadedNames).toEqual([expectedA, expectedB])
    expect(resolveIpAdapterWorkflowImage(db, 'ent_a')?.filename).toBe(expectedA)
    expect(resolveIpAdapterWorkflowImage(db, 'ent_b')?.filename).toBe(expectedB)
  })

  it('repairs legacy shared reference-anchor.png cache entries by re-uploading under a digest filename', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_legacy', type: 'character', name: 'Legacy' })
    const bytes = Buffer.from('legacy-face-bytes')
    const digest = imagePayloadDigest(bytes)
    const reference = createVisualAnchor(db, {
      id: 'anchor_legacy_ref',
      entityId: 'ent_legacy',
      type: 'reference_image',
      payload: bytes,
      isPrimary: true,
    })
    createVisualAnchor(db, {
      id: 'anchor_legacy_embed',
      entityId: 'ent_legacy',
      type: 'ipadapter_embedding',
      payload: serializeIpAdapterEmbeddingPayload({
        sourceAnchorId: reference.id,
        imageDigest: digest,
        comfyImage: { filename: 'reference-anchor.png', subfolder: '', type: 'input' },
        clipEmbedding: deriveClipVisionEmbeddingFromImage(bytes),
      }),
      isPrimary: false,
    })

    expect(resolveIpAdapterWorkflowImage(db, 'ent_legacy')?.filename).toBeUndefined()

    const fetchImpl = vi.fn(async (_url, init) => {
      const file = init.body.get('image')
      return {
        ok: true,
        json: async () => ({ name: file.name, subfolder: '', type: 'input' }),
      }
    })
    const expected = comfyUploadFilenameForImageDigest(digest)
    const repaired = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_legacy',
      comfyService: { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } },
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(repaired?.comfyImage?.filename).toBe(expected)
    expect(resolveIpAdapterWorkflowImage(db, 'ent_legacy')?.filename).toBe(expected)
  })
})
