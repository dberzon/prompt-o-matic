import { randomUUID } from 'node:crypto'
import { createGeneratedImageRecord, getCharacter, getPromptPack, listPromptPacks } from '../db/repositories.js'
import { parseGeneratedImageRecord } from '../characters/schemas.js'
import {
  injectPromptPackIntoWorkflow,
  listAvailableWorkflows,
  loadWorkflowMapping,
  loadWorkflowTemplate,
  resolveWorkflowSelection,
  validateWorkflowMapping,
} from './workflowMapping.js'

const DEFAULT_COMFY_URL = 'http://127.0.0.1:8188'
const DEFAULT_WORKFLOW_ID = 'qwen-image-2512-default'

function timeoutFor(env = process.env) {
  const value = Number.parseInt(env.COMFYUI_TIMEOUT_MS || '45000', 10)
  return Number.isFinite(value) ? value : 45000
}

function baseUrl(env = process.env) {
  return (env.COMFYUI_BASE_URL || DEFAULT_COMFY_URL).replace(/\/+$/, '')
}

export function dimensionsFromAspectRatio(aspectRatio = '2:3') {
  const map = {
    '2:3': { width: 832, height: 1248 },
    '3:4': { width: 960, height: 1280 },
    '16:9': { width: 1344, height: 768 },
    '1:1': { width: 1024, height: 1024 },
  }
  return map[aspectRatio] || map['2:3']
}

export function buildComfyPromptPayload({ promptPack, seed, workflowId, dimensions, allowWorkflowFallback }) {
  const seedValue = Number.isInteger(seed) ? seed : (Number.isInteger(promptPack.seedHint) ? promptPack.seedHint : Math.floor(Math.random() * 1000000000))
  const dims = dimensions || dimensionsFromAspectRatio(promptPack.aspectRatio)
  const workflowRequest = workflowId || promptPack.comfyWorkflowId || process.env.COMFYUI_DEFAULT_WORKFLOW_ID || null
  const workflowSelection = resolveWorkflowSelection(workflowRequest, {
    allowFallback: allowWorkflowFallback === true || !workflowRequest,
  })
  const requestedWorkflowId = workflowSelection.requestedWorkflowId
  const resolvedWorkflowId = workflowSelection.resolvedWorkflowId
  const workflow = loadWorkflowTemplate(resolvedWorkflowId)
  const mapping = loadWorkflowMapping(resolvedWorkflowId)
  const validation = validateWorkflowMapping({ workflow, mapping })
  if (!validation.ok) {
    const err = new Error(`Workflow mapping validation failed: ${validation.errors.join('; ')}`)
    err.status = 400
    err.details = validation
    throw err
  }
  const injectedWorkflow = injectPromptPackIntoWorkflow({
    workflow,
    mapping,
    promptPack,
    seed: seedValue,
    width: dims.width,
    height: dims.height,
    modelName: undefined,
    batchSize: 1,
  })

  return {
    prompt: injectedWorkflow,
    workflowId: resolvedWorkflowId,
    requestedWorkflowId,
    resolvedWorkflowId,
    usedFallback: workflowSelection.usedFallback,
    seed: seedValue,
    width: dims.width,
    height: dims.height,
    mappingValidation: validation,
  }
}

async function fetchJsonWithTimeout(url, init = {}, fetchImpl = fetch, timeoutMs = 45000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      const body = await response.text()
      const err = new Error(`Comfy request failed: ${response.status}`)
      err.status = 502
      err.meta = body
      throw err
    }
    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Comfy request timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export function createComfyService({ env = process.env, fetchImpl = fetch } = {}) {
  const comfyBaseUrl = baseUrl(env)
  const timeoutMs = timeoutFor(env)

  async function healthCheck() {
    try {
      await fetchJsonWithTimeout(`${comfyBaseUrl}/system_stats`, {}, fetchImpl, timeoutMs)
      return { available: true, baseUrl: comfyBaseUrl }
    } catch (error) {
      return { available: false, baseUrl: comfyBaseUrl, error: error?.message || 'Comfy unavailable' }
    }
  }

  async function queueWorkflow(payload) {
    const body = {
      prompt: payload.prompt,
      client_id: `qpb_${randomUUID()}`,
    }
    if (payload.front) body.front = true
    const data = await fetchJsonWithTimeout(`${comfyBaseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, fetchImpl, timeoutMs)
    return data
  }

  async function queuePromptPack({ promptPack, seed, workflowId, dimensions, dryRun = false, allowWorkflowFallback = false, front = false }) {
    const payload = buildComfyPromptPayload({
      promptPack,
      seed,
      workflowId,
      dimensions,
      allowWorkflowFallback,
    })
    if (dryRun) {
      return {
        promptId: null,
        number: null,
        workflowId: payload.workflowId,
        requestedWorkflowId: payload.requestedWorkflowId,
        resolvedWorkflowId: payload.resolvedWorkflowId,
        usedFallback: payload.usedFallback,
        seed: payload.seed,
        width: payload.width,
        height: payload.height,
        dryRun: true,
        payloadSummary: {
          promptNodeCount: Object.keys(payload.prompt || {}).length,
          mappingValidation: payload.mappingValidation,
        },
        prompt: payload.prompt,
      }
    }
    const queued = await queueWorkflow({ ...payload, front })
    return {
      promptId: queued.prompt_id || queued.promptId || null,
      number: queued.number ?? null,
      workflowId: payload.workflowId,
      requestedWorkflowId: payload.requestedWorkflowId,
      resolvedWorkflowId: payload.resolvedWorkflowId,
      usedFallback: payload.usedFallback,
      seed: payload.seed,
      width: payload.width,
      height: payload.height,
      raw: queued,
    }
  }

  async function getJobStatus(promptId) {
    const running = await fetchJsonWithTimeout(`${comfyBaseUrl}/queue`, {}, fetchImpl, timeoutMs)
    const history = await fetchJsonWithTimeout(`${comfyBaseUrl}/history/${encodeURIComponent(promptId)}`, {}, fetchImpl, timeoutMs)
    return { promptId, queue: running, history }
  }

  function mapHistoryToGeneratedImageRecords({
    promptId,
    promptPack,
    characterId,
    viewType = 'other',
    workflowVersion = 'qwen-image-2512-default',
    historyPayload,
  }) {
    const entries = historyPayload?.[promptId]?.outputs || {}
    const records = []
    for (const nodeValue of Object.values(entries)) {
      const images = Array.isArray(nodeValue?.images) ? nodeValue.images : []
      for (const image of images) {
        const imagePath = [image.subfolder, image.filename].filter(Boolean).join('/')
        const record = parseGeneratedImageRecord({
          id: `gen_${randomUUID()}`,
          characterId: characterId || promptPack.characterId,
          projectId: promptPack.projectId,
          imagePath: imagePath || image.filename || `comfy://${promptId}`,
          promptPackId: promptPack.id || promptPack.promptPackId || '',
          positivePrompt: promptPack.positivePrompt,
          negativePrompt: promptPack.negativePrompt || '',
          seed: promptPack.seedHint,
          modelName: 'qwen-image-2512',
          workflowVersion,
          viewType,
          approved: false,
          comfyImage: {
            filename: image.filename || imagePath || '',
            subfolder: image.subfolder || '',
            type: image.type || 'output',
          },
          createdAt: new Date().toISOString(),
        })
        records.push(record)
      }
    }
    return records
  }

  function ingestHistoryOutputs({
    db,
    promptId,
    promptPack,
    characterId,
    viewType,
    workflowVersion,
    historyPayload,
  }) {
    const records = mapHistoryToGeneratedImageRecords({
      promptId,
      promptPack,
      characterId,
      viewType,
      workflowVersion,
      historyPayload,
    })
    const persisted = []
    for (const record of records) {
      persisted.push(createGeneratedImageRecord(db, record))
    }
    return persisted
  }

  async function queuePromptPackById({
    db, promptPackId, seed, workflowId, dimensions, dryRun = false, allowWorkflowFallback = false, front = false,
  }) {
    const promptPack = getPromptPack(db, promptPackId)
    if (!promptPack) {
      const err = new Error('Prompt pack not found')
      err.status = 404
      throw err
    }
    const queued = await queuePromptPack({
      promptPack,
      seed,
      workflowId,
      dimensions,
      dryRun,
      allowWorkflowFallback,
      front,
    })
    return { promptPackId, ...queued }
  }

  async function queueCharacter({ db, characterId, views = [], options = {} }) {
    const character = getCharacter(db, characterId)
    if (!character) {
      const err = new Error('Character not found')
      err.status = 404
      throw err
    }
    const packs = listPromptPacks(db, { characterId })
    const filtered = views.length
      ? packs.filter((pack) => views.some((view) => pack.consistencyTags?.includes(view)))
      : packs

    const queued = []
    for (const pack of filtered) {
      const result = await queuePromptPack({
        promptPack: pack,
        seed: options.seed,
        workflowId: options.workflowId,
        dryRun: options.dryRun === true,
        allowWorkflowFallback: options.allowWorkflowFallback === true,
      })
      queued.push({
        promptPackId: pack.id,
        view: pack.consistencyTags?.find((tag) => tag.endsWith('_portrait') || tag === 'full_body' || tag === 'audition_still' || tag === 'cinematic_scene') || 'other',
        ...result,
      })
    }
    return { characterId, queued }
  }

  return {
    healthCheck,
    queuePromptPack,
    queuePromptPackById,
    queueCharacter,
    getJobStatus,
    mapHistoryToGeneratedImageRecords,
    ingestHistoryOutputs,
    config: {
      baseUrl: comfyBaseUrl,
      timeoutMs,
    },
    validateWorkflow(workflowId = DEFAULT_WORKFLOW_ID) {
      const selection = resolveWorkflowSelection(workflowId, { allowFallback: true })
      const resolvedWorkflowId = selection.resolvedWorkflowId
      const workflow = loadWorkflowTemplate(resolvedWorkflowId)
      const mapping = loadWorkflowMapping(resolvedWorkflowId)
      const result = validateWorkflowMapping({ workflow, mapping })
      return {
        ok: result.ok,
        workflowId: resolvedWorkflowId,
        requestedWorkflowId: workflowId,
        resolvedWorkflowId,
        usedFallback: selection.usedFallback,
        found: result.found,
        errors: result.errors,
        mapping,
      }
    },
    listWorkflows() {
      return {
        ok: true,
        defaultWorkflowId: DEFAULT_WORKFLOW_ID,
        requestedWorkflowId: null,
        resolvedWorkflowId: DEFAULT_WORKFLOW_ID,
        usedFallback: false,
        workflows: listAvailableWorkflows(),
      }
    },
  }
}
