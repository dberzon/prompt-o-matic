import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComfyService } from '../comfy/comfyService.js'
import { createEntity, writeAttribute } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { CONTINUITY_QA_SCENES } from './continuityQaHarness.js'
import { applySceneOverlayToPromptPack, runContinuityQaGenerations } from './continuityQaGeneration.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-continuity-qa-gen-test-'))
  tempDirs.push(dir)
  const dbPath = path.join(dir, 'test.sqlite')
  const db = createSqliteDatabase({ env: { APP_MODE: 'local-studio' }, dbPath })
  initializeDatabase(db)
  openDbs.push(db)
  return db
}

function seedEntity(db, entityId = 'ruslan_levashov') {
  createEntity(db, { id: entityId, type: 'character', name: 'Ruslan Levashov' })
  writeAttribute(db, { entityId, key: 'eyes', value: 'small piggy eyes', provenance: 'canon' })
  writeAttribute(db, { entityId, key: 'wardrobe', value: 'worn student jacket', provenance: 'canon' })
  writeAttribute(db, {
    entityId,
    key: 'visual.descriptor',
    value: 'frontal portrait, neutral expression, plain backdrop',
    provenance: 'inferred',
    sourceStage: 5,
  })
  return entityId
}

function mockComfyFetch() {
  let promptCounter = 0
  const historyCalls = new Map()
  return vi.fn(async (url, init = {}) => {
    const target = String(url)
    if (target.endsWith('/prompt') && init.method === 'POST') {
      promptCounter += 1
      return { ok: true, json: async () => ({ prompt_id: `prompt_qa_${promptCounter}`, number: promptCounter }) }
    }
    if (target.endsWith('/queue')) {
      return { ok: true, json: async () => ({ queue_running: [], queue_pending: [] }) }
    }
    const historyMatch = target.match(/\/history\/(prompt_qa_\d+)/)
    if (historyMatch) {
      const promptId = historyMatch[1]
      const calls = (historyCalls.get(promptId) || 0) + 1
      historyCalls.set(promptId, calls)
      if (calls < 2) {
        return { ok: true, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({
          [promptId]: {
            status: { status_str: 'success' },
            outputs: {
              '9': { images: [{ filename: `${promptId}.png`, subfolder: '', type: 'output' }] },
            },
          },
        }),
      }
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

describe('continuity QA generation', () => {
  it('applies scene metadata to prompt packs', () => {
    const scene = CONTINUITY_QA_SCENES[0]
    const pack = applySceneOverlayToPromptPack({
      positivePrompt: 'base prompt',
      consistencyTags: ['entity'],
    }, scene)
    expect(pack.positivePrompt).toContain(scene.environment)
    expect(pack.consistencyTags).toContain(scene.id)
  })

  it('dry-runs five scene generations and returns a scoring sheet', async () => {
    const db = createTempDb()
    const entityId = seedEntity(db)
    const fetchImpl = mockComfyFetch()
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })
    const result = await runContinuityQaGenerations({
      db,
      entityId,
      comfyService,
      input: { queue: { dryRun: true } },
    })
    expect(result.sceneCount).toBe(5)
    expect(result.outputs).toHaveLength(5)
    expect(result.scoringSheet.scenes).toHaveLength(5)
    expect(result.outputs.every((item) => item.entityId === entityId)).toBe(true)
  })

  it('persists generated images linked to the entity id', async () => {
    const db = createTempDb()
    const entityId = seedEntity(db)
    const fetchImpl = mockComfyFetch()
    const comfyService = createComfyService({
      fetchImpl,
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188', COMFYUI_TIMEOUT_MS: '5000' },
    })
    const result = await runContinuityQaGenerations({
      db,
      entityId,
      comfyService,
      scenes: [CONTINUITY_QA_SCENES[0]],
      input: { queue: {} },
      sleep: () => Promise.resolve(),
    })
    expect(result.outputs[0].generatedImageIds.length).toBeGreaterThan(0)
    expect(result.outputs[0].generatedImages[0].characterId).toBe(entityId)
  })
})
