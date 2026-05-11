import { compileEntityPromptPacks } from '../prompts/qwenPromptCompiler.js'
import { createPromptPack } from '../db/repositories.js'
import {
  CONTINUITY_QA_SCENES,
  buildContinuityQaScoringSheet,
} from './continuityQaHarness.js'

function classifyJobStatus(raw, promptId) {
  const historyEntry = raw?.history?.[promptId]
  const statusStr = historyEntry?.status?.status_str
  if (statusStr === 'success') return 'success'
  if (statusStr === 'error') return 'failed'
  const running = Array.isArray(raw?.queue?.queue_running)
    ? raw.queue.queue_running.some((entry) => entry?.[1] === promptId)
    : false
  if (running) return 'running'
  return 'unknown'
}

async function waitForComfyPromptSuccess(comfyService, promptId, { pollIntervalMs, timeoutMs, sleep }) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const statusRaw = await comfyService.getJobStatus(promptId)
    const status = classifyJobStatus(statusRaw, promptId)
    if (status === 'success') return statusRaw
    if (status === 'failed') {
      const err = new Error('Comfy render failed')
      err.status = 502
      throw err
    }
    await sleep(pollIntervalMs)
  }
  const err = new Error('Comfy render timed out')
  err.status = 504
  throw err
}

export function applySceneOverlayToPromptPack(pack, scene) {
  const overlay = [
    `scene environment: ${scene.environment}`,
    `lighting: ${scene.lighting}`,
    `composition: ${scene.composition}`,
    `time of day: ${scene.timeOfDay}`,
  ].join(', ')
  return {
    ...pack,
    positivePrompt: `${pack.positivePrompt}, ${overlay}`,
    background: scene.environment,
    lighting: scene.lighting,
    consistencyTags: [...(pack.consistencyTags || []), scene.id, 'continuity-qa'],
  }
}

export async function runContinuityQaGenerations({
  db,
  entityId,
  comfyService,
  scenes = CONTINUITY_QA_SCENES,
  input = {},
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const queueOptions = input.queue || {}
  const compileOptions = input.compile || {}
  const pollIntervalMs = Number.isFinite(input.pollIntervalMs) ? input.pollIntervalMs : 1000
  const timeoutMs = Number.isFinite(input.timeoutMs) ? input.timeoutMs : 120000
  const dryRun = queueOptions.dryRun === true
  const outputs = []

  for (const scene of scenes) {
    const compiled = compileEntityPromptPacks({
      db,
      entityId,
      input: {
        views: ['cinematic_scene'],
        scopeEntityIds: compileOptions.scopeEntityIds || [],
        options: {
          persist: false,
          ...compileOptions.options,
        },
      },
    })
    const basePack = compiled.packs?.[0]
    if (!basePack) {
      const err = new Error(`Failed to compile prompt pack for scene ${scene.id}`)
      err.status = 500
      throw err
    }
    const promptPack = createPromptPack(db, applySceneOverlayToPromptPack(basePack, scene))
    const queued = await comfyService.queuePromptPack({
      promptPack,
      seed: queueOptions.seed,
      workflowId: queueOptions.workflowId,
      dimensions: queueOptions.dimensions,
      dryRun,
      allowWorkflowFallback: queueOptions.allowWorkflowFallback === true,
      front: queueOptions.front === true,
      db,
      entityId,
      ipadapterStrength: queueOptions.ipadapterStrength,
    })

    if (dryRun) {
      outputs.push({
        sceneId: scene.id,
        entityId,
        promptPackId: promptPack.id,
        generatedImageIds: [],
        queue: queued,
        dryRun: true,
      })
      continue
    }

    if (!queued.promptId) {
      const err = new Error(`Comfy queue did not return promptId for scene ${scene.id}`)
      err.status = 502
      throw err
    }

    const statusRaw = await waitForComfyPromptSuccess(comfyService, queued.promptId, {
      pollIntervalMs,
      timeoutMs,
      sleep,
    })
    const generatedImages = comfyService.ingestHistoryOutputs({
      db,
      promptId: queued.promptId,
      promptPack,
      characterId: entityId,
      viewType: 'cinematic_scene',
      workflowVersion: queued.resolvedWorkflowId || queued.workflowId || 'qwen-image-2512-default',
      historyPayload: statusRaw.history,
    })

    outputs.push({
      sceneId: scene.id,
      entityId,
      promptPackId: promptPack.id,
      promptId: queued.promptId,
      generatedImageIds: generatedImages.map((item) => item.id),
      generatedImages,
      queue: {
        workflowId: queued.workflowId,
        requestedWorkflowId: queued.requestedWorkflowId,
        resolvedWorkflowId: queued.resolvedWorkflowId,
        usedFallback: queued.usedFallback,
        seed: queued.seed,
        width: queued.width,
        height: queued.height,
      },
    })
  }

  return {
    ok: true,
    entityId,
    sceneCount: scenes.length,
    outputs,
    scoringSheet: buildContinuityQaScoringSheet(),
  }
}
