import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComfyService } from '../comfy/comfyService.js'
import { createEntity, listVisualAnchors, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import {
  resolveStage5VisualDescriptor,
  triggerStage5ReferenceImageGeneration,
} from './stage5ReferenceGeneration.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-stage5-refgen-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function mockComfyFetch({ imageBytes = Buffer.from('png-bytes') } = {}) {
  let historyCalls = 0
  return vi.fn(async (url, init = {}) => {
    const target = String(url)
    if (target.endsWith('/prompt') && init.method === 'POST') {
      return { ok: true, json: async () => ({ prompt_id: 'prompt_stage5_1', number: 1 }) }
    }
    if (target.endsWith('/queue')) {
      return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
    }
    if (target.includes('/history/prompt_stage5_1')) {
      historyCalls += 1
      if (historyCalls < 2) {
        return { ok: true, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({
          prompt_stage5_1: {
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

describe('stage 5 reference generation', () => {
  it('resolves visual.descriptor from selected attributes', () => {
    const descriptor = resolveStage5VisualDescriptor([
      { key: 'visual.descriptor', value: 'frontal portrait', provenance: 'inferred', sourceStage: 5 },
      { key: 'wardrobe', value: 'coat', provenance: 'inferred' },
    ])
    expect(descriptor?.value).toBe('frontal portrait')
    expect(descriptor?.sourceStage).toBe(5)
  })

  it('triggers reference generation for stage 5 descriptors', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_stage5_1', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
      entityId: 'ent_stage5_1',
      key: 'eyes',
      value: 'small piggy eyes',
      provenance: 'canon',
    })
    writeAttribute(db, {
      entityId: 'ent_stage5_1',
      key: 'visual.descriptor',
      value: 'frontal portrait, neutral expression, plain backdrop',
      provenance: 'inferred',
      sourceStage: 5,
    })
    const fetchImpl = mockComfyFetch()
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })

    const result = await triggerStage5ReferenceImageGeneration({
      db,
      entityId: 'ent_stage5_1',
      comfyService,
      fetchImpl,
      input: { pollIntervalMs: 1, timeoutMs: 5000 },
      sleep: async () => {},
    })

    expect(result.stage).toBe(5)
    expect(result.feature).toBe('F_CONT_REFGEN')
    expect(result.visualDescriptor).toContain('frontal portrait')
    expect(result.anchor.isPrimary).toBe(true)
    expect(listVisualAnchors(db, { entityId: 'ent_stage5_1', type: 'reference_image' })).toHaveLength(1)
  })

  it('rejects descriptors that were not produced by stage 5', async () => {
    const db = createTempDb()
    createEntity(db, { id: 'ent_stage5_2', type: 'character', name: 'Ruslan' })
    writeAttribute(db, {
      entityId: 'ent_stage5_2',
      key: 'visual.descriptor',
      value: 'frontal portrait',
      provenance: 'inferred',
      sourceStage: 3,
    })
    const comfyService = createComfyService({
      fetchImpl: vi.fn(),
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' },
    })

    await expect(triggerStage5ReferenceImageGeneration({
      db,
      entityId: 'ent_stage5_2',
      comfyService,
    })).rejects.toThrow('visual.descriptor must be produced by stage 5')
  })
})
