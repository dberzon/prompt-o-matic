import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCharacter, createPromptPack, getGeneratedImageRecord } from '../db/repositories.js'
import { createSqliteDatabase, initializeDatabase } from '../db/sqlite.js'
import { validCharacterProfile, validQwenImagePromptPack } from '../characters/fixtures.js'
import { createComfyService, buildComfyPromptPayload, dimensionsFromAspectRatio } from './comfyService.js'
import { injectPromptPackIntoWorkflow, validateWorkflowMapping } from './workflowMapping.js'

const tempDirs = []
const openDbs = []

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-comfy-test-'))
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

describe('comfy service', () => {
  it('health check calls comfy endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ devices: [] }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const status = await svc.healthCheck()
    expect(status.available).toBe(true)
    expect(fetchImpl).toHaveBeenCalled()
  })

  it('aspect ratio maps correctly', () => {
    expect(dimensionsFromAspectRatio('2:3')).toEqual({ width: 832, height: 1248 })
    expect(dimensionsFromAspectRatio('16:9')).toEqual({ width: 1344, height: 768 })
  })

  it('queue prompt-pack builds payload and calls endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'p_123', number: 7 }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const payload = buildComfyPromptPayload({
      promptPack: validQwenImagePromptPack,
      workflowId: 'qwen-image-2512-default',
    })
    expect(payload.prompt['6'].inputs.text).toContain('woman in worn wool coat')
    const result = await svc.queuePromptPack({
      promptPack: validQwenImagePromptPack,
      workflowId: 'qwen-image-2512-default',
    })
    expect(result.promptId).toBe('p_123')
    expect(fetchImpl.mock.calls[0][0]).toContain('/prompt')
  })

  it('queue prompt-pack by id uses sqlite prompt pack', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_1' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_1',
      characterId: 'char_comfy_1',
      comfyWorkflowId: 'qwen-image-2512-default',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'p_abc', number: 1 }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = await svc.queuePromptPackById({ db, promptPackId: pack.id })
    expect(result.promptId).toBe('p_abc')
  })

  it('queue with unknown workflow fails without explicit fallback', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_unknown_1' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_unknown_1',
      characterId: 'char_comfy_unknown_1',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'unused' }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    await expect(svc.queuePromptPackById({
      db,
      promptPackId: pack.id,
      workflowId: 'does-not-exist',
      dryRun: false,
    })).rejects.toThrow('Unknown workflowId')
  })

  it('queue with unknown workflow can fallback only when explicitly allowed', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_unknown_2' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_unknown_2',
      characterId: 'char_comfy_unknown_2',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'p_fallback', number: 3 }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = await svc.queuePromptPackById({
      db,
      promptPackId: pack.id,
      workflowId: 'does-not-exist',
      allowWorkflowFallback: true,
    })
    expect(result.workflowId).toBe('qwen-image-2512-default')
    expect(result.usedFallback).toBe(true)
  })

  it('dry-run queue does not call comfy endpoint and returns injected values', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_2' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_2',
      characterId: 'char_comfy_2',
      aspectRatio: '3:4',
      comfyWorkflowId: 'qwen-image-2512-default',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'unused' }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = await svc.queuePromptPackById({ db, promptPackId: pack.id, dryRun: true })
    expect(result.dryRun).toBe(true)
    expect(result.width).toBe(960)
    expect(result.height).toBe(1280)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('dry-run with unknown workflow fails unless explicit fallback is enabled', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_dry_unknown_1' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_dry_unknown_1',
      characterId: 'char_comfy_dry_unknown_1',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'unused' }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    await expect(svc.queuePromptPackById({
      db,
      promptPackId: pack.id,
      workflowId: 'still-unknown',
      dryRun: true,
    })).rejects.toThrow('Unknown workflowId')
    const fallback = await svc.queuePromptPackById({
      db,
      promptPackId: pack.id,
      workflowId: 'still-unknown',
      dryRun: true,
      allowWorkflowFallback: true,
    })
    expect(fallback.workflowId).toBe('qwen-image-2512-default')
    expect(fallback.usedFallback).toBe(true)
  })

  it('ingests outputs into generated image records', () => {
    const db = createTempDb()
    const svc = createComfyService({
      env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' },
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    })
    const promptPack = {
      ...validQwenImagePromptPack,
      id: 'pack_ingest_1',
      characterId: 'char_ingest_1',
    }
    const historyPayload = {
      p_ingest: {
        outputs: {
          '9': {
            images: [{ filename: 'img1.png', subfolder: 'output', type: 'output' }],
          },
        },
      },
    }
    const created = svc.ingestHistoryOutputs({
      db,
      promptId: 'p_ingest',
      promptPack,
      characterId: 'char_ingest_1',
      viewType: 'front_portrait',
      workflowVersion: 'wf_v1',
      historyPayload,
    })
    expect(created.length).toBe(1)
    const persisted = getGeneratedImageRecord(db, created[0].id)
    expect(persisted.promptPackId).toBe('pack_ingest_1')
    expect(persisted.approved).toBe(false)
    expect(persisted.comfyImage).toEqual({
      filename: 'img1.png',
      subfolder: 'output',
      type: 'output',
    })
  })

  it('workflow mapping validates successfully', () => {
    const svc = createComfyService({ env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = svc.validateWorkflow('qwen-image-2512-default')
    expect(result.ok).toBe(true)
    expect(result.found.positivePrompt).toBeTruthy()
    expect(result.resolvedWorkflowId).toBe('qwen-image-2512-default')
    expect(result.usedFallback).toBe(false)
  })

  it('queue with no workflow id uses default workflow', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_no_wf' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_no_wf',
      characterId: 'char_comfy_no_wf',
      comfyWorkflowId: 'qwen-image-2512-default',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'p_default_no_wf', number: 2 }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = await svc.queuePromptPackById({ db, promptPackId: pack.id })
    expect(result.workflowId).toBe('qwen-image-2512-default')
    expect(result.usedFallback).toBe(false)
  })

  it('queue with known workflow id succeeds', async () => {
    const db = createTempDb()
    createCharacter(db, { ...validCharacterProfile, id: 'char_comfy_known_wf' })
    const pack = createPromptPack(db, {
      ...validQwenImagePromptPack,
      id: 'pack_comfy_known_wf',
      characterId: 'char_comfy_known_wf',
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ prompt_id: 'p_known_wf', number: 2 }),
    }))
    const svc = createComfyService({ fetchImpl, env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = await svc.queuePromptPackById({
      db,
      promptPackId: pack.id,
      workflowId: 'qwen-image-2512-default',
    })
    expect(result.promptId).toBe('p_known_wf')
    expect(result.usedFallback).toBe(false)
  })

  it('list workflows response shape is stable', () => {
    const svc = createComfyService({ env: { COMFYUI_BASE_URL: 'http://127.0.0.1:8188' } })
    const result = svc.listWorkflows()
    expect(result.ok).toBe(true)
    expect(result.defaultWorkflowId).toBe('qwen-image-2512-default')
    expect(result).toHaveProperty('requestedWorkflowId')
    expect(result).toHaveProperty('resolvedWorkflowId')
    expect(result).toHaveProperty('usedFallback')
    expect(Array.isArray(result.workflows)).toBe(true)
    expect(result.workflows[0]).toHaveProperty('workflowId')
    expect(result.workflows[0]).toHaveProperty('hasTemplate')
    expect(result.workflows[0]).toHaveProperty('hasMapping')
    expect(result.workflows[0]).toHaveProperty('valid')
    expect(result.workflows[0]).toHaveProperty('errors')
  })

  it('missing mapped node fails clearly', () => {
    const workflow = { '1': { inputs: { text: '' } } }
    const mapping = {
      fields: {
        positivePrompt: { nodeId: '6', inputKey: 'text' },
        negativePrompt: { nodeId: '7', inputKey: 'text' },
        seed: { nodeId: '10', inputKey: 'seed' },
        width: { nodeId: '5', inputKey: 'width' },
        height: { nodeId: '5', inputKey: 'height' },
      },
    }
    const result = validateWorkflowMapping({ workflow, mapping })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('Mapped node'))).toBe(true)
  })

  it('missing mapped input fails clearly', () => {
    const workflow = {
      '6': { inputs: { text: '' } },
      '7': { inputs: { text: '' } },
      '10': { inputs: { seed: 1 } },
      '5': { inputs: { width: 512 } },
    }
    const mapping = {
      fields: {
        positivePrompt: { nodeId: '6', inputKey: 'text' },
        negativePrompt: { nodeId: '7', inputKey: 'text' },
        seed: { nodeId: '10', inputKey: 'seed' },
        width: { nodeId: '5', inputKey: 'width' },
        height: { nodeId: '5', inputKey: 'height' },
      },
    }
    const result = validateWorkflowMapping({ workflow, mapping })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('Mapped input'))).toBe(true)
  })

  it('injection fails clearly when mapping invalid', () => {
    const workflow = {
      '6': { inputs: { text: '' } },
      '7': { inputs: { text: '' } },
      '10': { inputs: { seed: 1 } },
      '5': { inputs: { width: 512 } },
    }
    const mapping = {
      fields: {
        positivePrompt: { nodeId: '6', inputKey: 'text' },
        negativePrompt: { nodeId: '7', inputKey: 'text' },
        seed: { nodeId: '10', inputKey: 'seed' },
        width: { nodeId: '5', inputKey: 'width' },
        height: { nodeId: '5', inputKey: 'height' },
      },
    }
    expect(() => injectPromptPackIntoWorkflow({
      workflow,
      mapping,
      promptPack: validQwenImagePromptPack,
      seed: 1,
      width: 512,
      height: 768,
    })).toThrow('Invalid workflow mapping')
  })
})
