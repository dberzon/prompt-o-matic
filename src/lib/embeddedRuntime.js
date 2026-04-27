import { invoke } from '@tauri-apps/api/core'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function safeInvoke(command, args = {}) {
  if (!isTauri()) {
    throw new Error('Embedded runtime commands are only available in desktop build')
  }
  return invoke(command, args)
}

export async function getEmbeddedStatus() {
  try {
    const status = await safeInvoke('sidecar_status')
    return { available: true, ...status }
  } catch {
    return { available: false, running: false }
  }
}

export async function startEmbeddedSidecar({
  modelPath,
  port,
  threads,
  ctxSize,
  nGpuLayers,
}) {
  return safeInvoke('sidecar_start', {
    args: {
      model_path: modelPath,
      port,
      threads,
      ctx_size: ctxSize,
      n_gpu_layers: nGpuLayers,
    },
  })
}

export async function stopEmbeddedSidecar() {
  return safeInvoke('sidecar_stop')
}

export async function listAvailableModels() {
  return safeInvoke('models_list_available')
}

export async function listInstalledModels() {
  return safeInvoke('models_list_installed')
}

export async function startModelDownload(modelId) {
  return safeInvoke('models_download_start', { modelId })
}

export async function verifyModel(modelId) {
  return safeInvoke('models_verify', { modelId })
}

export async function deleteModel(modelId) {
  return safeInvoke('models_delete', { modelId })
}

export async function setDefaultModel(modelId) {
  return safeInvoke('models_set_default', { modelId })
}

export function canUseEmbeddedRuntime() {
  return isTauri()
}
