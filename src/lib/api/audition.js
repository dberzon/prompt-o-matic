import { apiPost } from './http.js'

/**
 * POST /api/audition/generate
 * Body: { bankEntryId, count?, view? }
 * Returns: { ok, bankEntryId, bankEntrySlug, requested, successful, failed, results: [...] }
 * Each successful result item has: { ok:true, characterId, actorCandidateId, auditionId, promptPackId, comfyPromptId, comfyError }
 * Each failed result item has: { ok:false, error, code }
 */
export function generateAudition({ bankEntryId, count = 3, view = 'front_portrait' }) {
  return apiPost('/api/audition/generate', { bankEntryId, count, view })
}
