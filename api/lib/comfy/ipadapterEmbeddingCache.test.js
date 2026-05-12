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
  deriveClipVisionEmbeddingFromImage,
  ensureIpAdapterEmbeddingCache,
  imagePayloadDigest,
  parseIpAdapterEmbeddingPayload,
  resolveIpAdapterWorkflowImage,
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

  it('does not invent a Comfy filename when upload is skipped for image bytes', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_skip_upload', type: 'character', name: 'Ruslan' })
    createVisualAnchor(db, {
      id: 'anchor_skip_upload',
      entityId: 'ent_skip_upload',
      type: 'reference_image',
      payload: Buffer.from('png-bytes'),
      isPrimary: true,
    })

    const fetchImpl = vi.fn()
    const cached = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_skip_upload',
      comfyService: { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } },
      fetchImpl,
      skipUpload: true,
    })

    expect(cached?.clipEmbedding).toHaveLength(768)
    expect(cached?.comfyImage).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()

    const resolvedBeforeUpload = resolveIpAdapterWorkflowImage(db, 'ent_skip_upload')
    expect(resolvedBeforeUpload?.kind).toBe('reference')
    expect(Buffer.isBuffer(resolvedBeforeUpload?.image)).toBe(true)

    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'uploaded-after-skip.png', subfolder: '', type: 'input' }),
    })
    const uploaded = await ensureIpAdapterEmbeddingCache({
      db,
      entityId: 'ent_skip_upload',
      comfyService: { config: { baseUrl: 'http://127.0.0.1:8188', timeoutMs: 5000 } },
      fetchImpl,
    })

    expect(uploaded?.comfyImage?.filename).toBe('uploaded-after-skip.png')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(resolveIpAdapterWorkflowImage(db, 'ent_skip_upload')?.filename).toBe('uploaded-after-skip.png')
  })
})
