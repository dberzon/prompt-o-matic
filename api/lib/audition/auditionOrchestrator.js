import { randomUUID } from 'node:crypto'
import {
  createActorAudition,
  createActorCandidate,
  createCharacter,
  getBankEntry,
} from '../db/repositories.js'
import { parseJsonFromLlmText } from '../characters/jsonUtils.js'
import { parseCharacterProfile } from '../characters/schemas.js'
import { compileCharacterPromptPacks } from '../prompts/qwenPromptCompiler.js'
import { buildBankEntryAuditionPrompt } from './auditionPrompts.js'

const DEFAULT_VIEWS = ['front_portrait', 'profile_portrait']

export async function runAudition({
  db,
  bankEntryId,
  count = 3,
  views = DEFAULT_VIEWS,
  workflowId,
  llmGenerate,
  comfyService = null,
}) {
  if (!db) throw new Error('runAudition requires db')
  if (!bankEntryId) throw new Error('runAudition requires bankEntryId')
  if (typeof llmGenerate !== 'function') throw new Error('runAudition requires llmGenerate function')

  const bankEntry = getBankEntry(db, bankEntryId)
  if (!bankEntry) {
    const err = new Error('Bank entry not found')
    err.status = 404
    err.code = 'BANK_ENTRY_NOT_FOUND'
    throw err
  }

  const safeViews = Array.isArray(views) && views.length > 0
    ? views.filter((v) => typeof v === 'string' && v.trim())
    : DEFAULT_VIEWS

  const safeCount = Math.max(1, Math.min(10, Math.trunc(count) || 1))
  const userPrompt = buildBankEntryAuditionPrompt({ bankEntry, count: safeCount })

  const llmText = await llmGenerate({
    system: 'You are a strict JSON generator. Return a JSON array only.',
    user: userPrompt,
    providerPayload: { engine: 'auto', responseFormat: 'json' },
  })

  const parsed = parseJsonFromLlmText(llmText)
  const rawProfiles = Array.isArray(parsed) ? parsed : [parsed]
  if (rawProfiles.length === 0) {
    const err = new Error('LLM returned no profiles')
    err.code = 'EMPTY_LLM_RESPONSE'
    throw err
  }

  const nowIso = new Date().toISOString()
  const results = []

  for (const rawProfile of rawProfiles.slice(0, safeCount)) {
    const pairId = randomUUID()

    try {
      // Validate and persist the character profile once per pair.
      // Coerce qwenPromptSeed: non-Qwen models emit it as a number; stringify or drop it.
      const rawQwenSeed = rawProfile?.qwenPromptSeed
      const qwenPromptSeed = typeof rawQwenSeed === 'string' && rawQwenSeed.trim()
        ? rawQwenSeed
        : typeof rawQwenSeed === 'number'
          ? String(rawQwenSeed)
          : undefined
      const candidatePayload = {
        ...rawProfile,
        id: randomUUID(),
        createdAt: nowIso,
        updatedAt: nowIso,
        embeddingStatus: 'not_indexed',
        name: rawProfile?.name || bankEntry.name,
        lifecycleStatus: 'auditioned',
        ...(qwenPromptSeed !== undefined ? { qwenPromptSeed } : { qwenPromptSeed: undefined }),
      }
      const validated = parseCharacterProfile(candidatePayload)
      const character = createCharacter(db, validated)

      // Generate one actor_candidate + audition per view in the pair.
      const viewResults = []
      for (const view of safeViews) {
        try {
          const compileResult = compileCharacterPromptPacks({
            db,
            input: { characterId: character.id, views: [view] },
          })
          const promptPack = compileResult?.packs?.[0] ?? null

          let comfyJob = null
          if (comfyService && promptPack) {
            try {
              comfyJob = await comfyService.queuePromptPackById({
                db,
                promptPackId: promptPack.id,
                workflowId: workflowId || undefined,
                allowWorkflowFallback: true,
              })
            } catch (queueErr) {
              comfyJob = { error: queueErr?.message || 'Comfy queue failed' }
            }
          }

          const actorCandidate = createActorCandidate(db, {
            status: 'available',
            sourceBankEntryId: bankEntry.id,
            promptPackId: promptPack?.id,
            notes: JSON.stringify({
              characterId: character.id,
              comfyPromptId: comfyJob?.promptId ?? null,
              pairId,
              view,
            }),
          })

          const audition = createActorAudition(db, {
            actorCandidateId: actorCandidate.id,
            bankEntryId: bankEntry.id,
            status: 'pending',
          })

          viewResults.push({
            ok: true,
            view,
            auditionId: audition.id,
            actorCandidateId: actorCandidate.id,
            promptPackId: promptPack?.id ?? null,
            comfyPromptId: comfyJob?.promptId ?? null,
            comfyError: comfyJob?.error ?? null,
          })
        } catch (viewErr) {
          viewResults.push({
            ok: false,
            view,
            error: viewErr?.message || 'View generation failed',
            code: viewErr?.code || 'VIEW_GENERATION_ERROR',
          })
        }
      }

      results.push({
        ok: true,
        pairId,
        characterId: character.id,
        character,
        views: viewResults,
      })
    } catch (err) {
      results.push({
        ok: false,
        error: err?.message || 'Unknown error',
        code: err?.code || 'AUDITION_ITEM_ERROR',
      })
    }
  }

  const successful = results.filter((r) => r.ok).length
  return {
    bankEntryId: bankEntry.id,
    bankEntrySlug: bankEntry.slug,
    requested: safeCount,
    successful,
    failed: results.length - successful,
    results,
  }
}
