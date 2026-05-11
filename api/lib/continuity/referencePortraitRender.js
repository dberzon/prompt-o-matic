import { createVisualAnchor } from '../db/repositories.js'
import { compileReferencePortraitPromptPack } from '../prompts/qwenPromptCompiler.js'

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

function selectHistoryOutputImage(historyPayload, promptId) {
  const outputs = historyPayload?.[promptId]?.outputs || {}
  for (const nodeValue of Object.values(outputs)) {
    const images = Array.isArray(nodeValue?.images) ? nodeValue.images : []
    if (images.length > 0) return images[0]
  }
  return null
}

function buildComfyViewUrl(baseUrl, image) {
  const params = new URLSearchParams({
    filename: image.filename,
    type: image.type || 'output',
  })
  if (image.subfolder) params.set('subfolder', image.subfolder)
  return `${baseUrl.replace(/\/+$/, '')}/view?${params.toString()}`
}

async function fetchComfyImageBytes(baseUrl, image, fetchImpl, timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(buildComfyViewUrl(baseUrl, image), { signal: controller.signal })
    if (!response.ok) {
      const err = new Error(`Comfy image fetch failed: ${response.status}`)
      err.status = 502
      throw err
    }
    return Buffer.from(await response.arrayBuffer())
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Comfy image fetch timed out')
      err.status = 504
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
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

export async function enqueueReferencePortraitRender({
  db,
  entityId,
  comfyService,
  input = {},
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const compileInput = input.compile || {}
  const queueOptions = input.queue || {}
  const pollIntervalMs = Number.isFinite(input.pollIntervalMs) ? input.pollIntervalMs : 1000
  const timeoutMs = Number.isFinite(input.timeoutMs) ? input.timeoutMs : 120000
  const fetchTimeoutMs = comfyService?.config?.timeoutMs || 45000

  const compiled = compileReferencePortraitPromptPack({
    db,
    entityId,
    input: compileInput,
  })
  const promptPack = compiled.pack
  const queued = await comfyService.queuePromptPack({
    promptPack,
    seed: queueOptions.seed,
    workflowId: queueOptions.workflowId,
    dimensions: queueOptions.dimensions,
    dryRun: queueOptions.dryRun === true,
    allowWorkflowFallback: queueOptions.allowWorkflowFallback === true,
    front: queueOptions.front === true,
  })
  if (queueOptions.dryRun === true) {
    return {
      ok: true,
      entityId: compiled.entityId,
      entityType: compiled.entityType,
      view: compiled.view,
      promptPackId: promptPack.id || null,
      dryRun: true,
      queue: queued,
    }
  }
  if (!queued.promptId) {
    const err = new Error('Comfy queue did not return promptId')
    err.status = 502
    throw err
  }

  const statusRaw = await waitForComfyPromptSuccess(comfyService, queued.promptId, {
    pollIntervalMs,
    timeoutMs,
    sleep,
  })
  const outputImage = selectHistoryOutputImage(statusRaw.history, queued.promptId)
  if (!outputImage?.filename) {
    const err = new Error('Comfy render completed without output images')
    err.status = 502
    throw err
  }

  const imageBytes = await fetchComfyImageBytes(
    comfyService.config.baseUrl,
    outputImage,
    fetchImpl,
    fetchTimeoutMs,
  )
  const anchor = createVisualAnchor(db, {
    entityId: compiled.entityId,
    type: 'reference_image',
    payload: imageBytes,
    isPrimary: true,
  })

  return {
    ok: true,
    entityId: compiled.entityId,
    entityType: compiled.entityType,
    view: compiled.view,
    promptPackId: promptPack.id,
    promptId: queued.promptId,
    anchor,
    queue: {
      workflowId: queued.workflowId,
      requestedWorkflowId: queued.requestedWorkflowId,
      resolvedWorkflowId: queued.resolvedWorkflowId,
      usedFallback: queued.usedFallback,
      seed: queued.seed,
      width: queued.width,
      height: queued.height,
    },
    outputImage: {
      filename: outputImage.filename,
      subfolder: outputImage.subfolder || '',
      type: outputImage.type || 'output',
    },
  }
}
