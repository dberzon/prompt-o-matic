import { apiPost } from './http.js'

/**
 * POST /api/audition/generate
 * Body: { bankEntryId, count?, views? }
 * Returns: { ok, bankEntryId, bankEntrySlug, requested, successful, failed, results: [...] }
 * Each successful result: { ok:true, pairId, characterId, views: [{ view, auditionId, actorCandidateId, promptPackId, comfyPromptId, comfyError }] }
 * Each failed result: { ok:false, error, code }
 */
export function generateAudition({ bankEntryId, count = 3, views = ['front_portrait', 'profile_portrait'], workflowId } = {}) {
  return apiPost('/api/audition/generate', { bankEntryId, count, views, ...(workflowId ? { workflowId } : {}) })
}
