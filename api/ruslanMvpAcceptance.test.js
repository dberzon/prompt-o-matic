import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildComfyPromptPayload, createComfyService } from './lib/comfy/comfyService.js'
import {
  createEntity,
  dismissSuggested,
  getAttribute,
  getEntity,
  listAttributes,
  listEntities,
  listVisualAnchors,
  promoteToCanon,
  writeAttribute,
} from './lib/db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from './lib/db/sqlite.js'
import { triggerStage5ReferenceImageGeneration } from './lib/extrapolation/stage5ReferenceGeneration.js'
import { RUSLAN_S1_FIXTURE, RUSLAN_SOURCE_TEXT } from './lib/extrapolation/fixtures/ruslanWorkedExample.js'
import { runExtrapolationPipeline } from './lib/extrapolation/orchestrator.js'
import { StageCache } from './lib/extrapolation/stageCache.js'
import { compileEntityPromptPacks } from './lib/prompts/qwenPromptCompiler.js'

const ENTITY_ID = 'ruslan_levashov'
const tempDirs = []
const openDbs = []

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-ruslan-mvp-'))
  tempDirs.push(dir)
  return path.join(dir, 'test.sqlite')
}

function ensureDb(dbPath) {
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function createRuslanStubLlm() {
  return async ({ user }) => {
    if (user.includes('Extract entities and canon attributes')) {
      return JSON.stringify(RUSLAN_S1_FIXTURE)
    }
    if (user.includes('period-specific clothing')) {
      return JSON.stringify({
        attributes: [
          { key: 'wardrobe.jacket', value: 'worn student jacket', confidence: 0.9 },
          { key: 'habit.cigarette', value: 'Belomorkanal', confidence: 0.8 },
        ],
      })
    }
    if (user.includes('Infer psychology attributes')) {
      return JSON.stringify({
        attributes: [{ key: 'behavior.temperament', value: 'wry and loyal', confidence: 0.7 }],
      })
    }
    if (user.includes('Project likely environments')) {
      return JSON.stringify({
        environments: [{ name: 'Soviet beer hall', summary: 'Friday hangout with friends' }],
        attributes: [{ key: 'routine.friday', value: 'spends Fridays at the beer hall' }],
      })
    }
    if (user.includes('Write a single visual descriptor')) {
      return JSON.stringify({
        visualDescriptor: 'frontal portrait, neutral expression, plain backdrop, freckled face',
      })
    }
    if (user.includes('Detect contradictions')) {
      return JSON.stringify({ conflicts: [] })
    }
    return '{}'
  }
}

function mockComfyFetch() {
  let historyCalls = 0
  return vi.fn(async (url, init = {}) => {
    const target = String(url)
    if (target.endsWith('/prompt') && init.method === 'POST') {
      return { ok: true, json: async () => ({ prompt_id: 'prompt_ruslan_anchor', number: 1 }) }
    }
    if (target.endsWith('/queue')) {
      return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
    }
    if (target.includes('/history/prompt_ruslan_anchor')) {
      historyCalls += 1
      if (historyCalls < 2) {
        return { ok: true, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({
          prompt_ruslan_anchor: {
            status: { status_str: 'success' },
            outputs: {
              '9': { images: [{ filename: 'ruslan-anchor.png', subfolder: '', type: 'output' }] },
            },
          },
        }),
      }
    }
    if (target.includes('/view?')) {
      return { ok: true, arrayBuffer: async () => Buffer.from('png-bytes') }
    }
    if (target.endsWith('/upload/image') && init.method === 'POST') {
      return { ok: true, json: async () => ({ name: 'ruslan-anchor-input.png', subfolder: '', type: 'input' }) }
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

describe('Ruslan MVP acceptance (Section 13 worked example)', () => {
  it('runs extrapolation, review, primary anchor, and from-entity pack compile', async () => {
    const db = ensureDb(createTempDbPath())
    createEntity(db, { id: ENTITY_ID, type: 'character', name: 'Ruslan Levashov' })
    writeAttribute(db, {
      entityId: ENTITY_ID,
      key: 'description',
      value: RUSLAN_SOURCE_TEXT,
      provenance: 'canon',
      confidence: 1,
      sourceStage: 0,
    })

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-ruslan-mvp-cache-'))
    tempDirs.push(cacheDir)
    const pipeline = await runExtrapolationPipeline({
      db,
      entityId: ENTITY_ID,
      llm: createRuslanStubLlm(),
      cache: new StageCache({ cacheDir }),
    })

    expect(pipeline.cancelled).toBe(false)
    expect(pipeline.stages).toHaveLength(6)
    expect(getEntity(db, 'rita_vlasova')?.name).toBe('Rita Vlasova')
    expect(listEntities(db, { type: 'environment' }).length).toBeGreaterThanOrEqual(2)
    expect(listEntities(db, { type: 'institution' }).length).toBeGreaterThanOrEqual(1)
    expect(listAttributes(db, { entityId: ENTITY_ID, provenance: 'canon' }).length).toBeGreaterThanOrEqual(12)

    const inferred = listAttributes(db, { entityId: ENTITY_ID, provenance: 'inferred' })
    expect(inferred.length).toBeGreaterThan(0)
    const promoted = promoteToCanon(db, inferred[0].id)
    expect(promoted.provenance).toBe('canon')

    const suggested = writeAttribute(db, {
      entityId: ENTITY_ID,
      key: 'review.dismissed',
      value: 'low-confidence wardrobe note',
      provenance: 'suggested',
      confidence: 0.4,
      sourceStage: 2,
    })
    expect(dismissSuggested(db, suggested.id)).toBe(true)
    expect(getAttribute(db, suggested.id).dismissedAt).toBeTruthy()

    const fetchImpl = mockComfyFetch()
    vi.stubGlobal('fetch', fetchImpl)
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })
    const anchorResult = await triggerStage5ReferenceImageGeneration({
      db,
      entityId: ENTITY_ID,
      comfyService,
      input: { pollIntervalMs: 1, timeoutMs: 5000 },
      sleep: () => Promise.resolve(),
    })
    expect(anchorResult.stage).toBe(5)
    expect(anchorResult.feature).toBe('F_CONT_REFGEN')

    const anchors = listVisualAnchors(db, { entityId: ENTITY_ID, type: 'reference_image' })
    expect(anchors.some((anchor) => anchor.isPrimary)).toBe(true)

    const compiled = compileEntityPromptPacks({
      db,
      entityId: ENTITY_ID,
      input: { views: ['front_portrait'], options: { persist: false } },
    })
    expect(compiled.ok).toBe(true)
    expect(compiled.packs).toHaveLength(1)
    expect(compiled.packs[0].positivePrompt).toContain('freckled face')

    const payload = buildComfyPromptPayload({
      promptPack: compiled.packs[0],
      workflowId: 'qwen-image-2512-default',
      db,
      entityId: ENTITY_ID,
      ipadapterStrength: 0.72,
    })
    expect(Buffer.isBuffer(payload.prompt['99'].inputs.image)).toBe(true)
    expect(listVisualAnchors(db, { entityId: ENTITY_ID, type: 'ipadapter_embedding' })).toHaveLength(1)
    expect(payload.prompt['98'].inputs.weight).toBe(0.72)

    fetchImpl.mockClear()
    await comfyService.queuePromptPack({
      promptPack: compiled.packs[0],
      workflowId: 'qwen-image-2512-default',
      db,
      entityId: ENTITY_ID,
      ipadapterStrength: 0.72,
    })
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/upload/image'))).toBe(true)
    const queuedPayload = buildComfyPromptPayload({
      promptPack: compiled.packs[0],
      workflowId: 'qwen-image-2512-default',
      db,
      entityId: ENTITY_ID,
      ipadapterStrength: 0.72,
    })
    expect(queuedPayload.prompt['99'].inputs.image).toBe('ruslan-anchor-input.png')
  })
})
