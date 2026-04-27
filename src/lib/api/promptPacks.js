import { apiGet, apiPost } from './http.js'

export function compilePromptPacksForCharacter(characterId, workflowId) {
  return apiPost('/api/prompt-pack-compile-character', {
    characterId,
    views: ['front_portrait'],
    options: {
      persist: true,
      ...(workflowId ? { comfyWorkflowId: workflowId } : {}),
    },
  })
}

export function listPromptPacksForCharacter(characterId) {
  return apiGet('/api/prompt-packs', { characterId })
}

