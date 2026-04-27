import { apiGet, apiPost } from './http.js'

export function getComfyStatus() {
  return apiGet('/api/comfy-status')
}

export function listComfyWorkflows() {
  return apiGet('/api/comfy-workflows')
}

export function validateComfyWorkflow(workflowId) {
  return apiPost('/api/comfy-validate-workflow', { workflowId })
}

export function queueComfyPromptPack({ promptPackId, workflowId, dryRun }) {
  return apiPost('/api/comfy-queue-prompt-pack', { promptPackId, workflowId, dryRun })
}

export function getComfyJobStatus(promptId) {
  return apiGet('/api/comfy-job-status', { id: promptId })
}

export function getComfyJobsStatus(jobs) {
  return apiPost('/api/comfy-jobs-status', { jobs })
}

export function ingestComfyOutputs({
  promptId,
  promptPackId,
  workflowVersion,
  characterId,
  viewType = 'front_portrait',
}) {
  return apiPost('/api/comfy-ingest-outputs', {
    promptId,
    promptPackId,
    workflowVersion,
    characterId,
    viewType,
  })
}

export function ingestComfyOutputsMany(jobs) {
  return apiPost('/api/comfy-ingest-many', { jobs })
}

