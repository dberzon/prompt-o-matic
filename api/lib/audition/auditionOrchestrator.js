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

export async function runAudition({
  db,
  bankEntryId,
  count = 3,
  view = 'front_portrait',
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
    try {
      // Normalize required server-side fields the LLM should not produce.
      const candidatePayload = {
        ...rawProfile,
        id: randomUUID(),
        createdAt: nowIso,
        updatedAt: nowIso,
        embeddingStatus: 'not_indexed',
        // Tag origin via name/projectId so the structured profile is traceable to the bank entry.
        name: rawProfile?.name || bankEntry.name,
      }

      // Validate strict-ly against CharacterProfileSchema.
      const validated = parseCharacterProfile(candidatePayload)

      // Persist structured character.
      const character = createCharacter(db, validated)

      // Compile prompt-pack for the requested view.
      const compileResult = compileCharacterPromptPacks({
        db,
        input: { characterId: character.id, views: [view] },
      })
      const promptPack = compileResult?.packs?.[0] ?? null

      // Optionally queue Comfy. Graceful no-op if comfyService is null.
      let comfyJob = null
      if (comfyService && promptPack) {
        try {
          comfyJob = await comfyService.queuePromptPackById({
            db,
            promptPackId: promptPack.id,
            allowWorkflowFallback: true,
          })
        } catch (queueErr) {
          comfyJob = { error: queueErr?.message || 'Comfy queue failed' }
        }
      }

      // Persist actor_candidate (links to bank entry, prompt pack, character via notes).
      const actorCandidate = createActorCandidate(db, {
        status: 'available',
        sourceBankEntryId: bankEntry.id,
        promptPackId: promptPack?.id,
        notes: JSON.stringify({
          characterId: character.id,
          comfyPromptId: comfyJob?.promptId ?? null,
        }),
      })

      // Persist actor_audition.
      const audition = createActorAudition(db, {
        actorCandidateId: actorCandidate.id,
        bankEntryId: bankEntry.id,
        status: 'pending',
      })

      results.push({
        ok: true,
        characterId: character.id,
        actorCandidateId: actorCandidate.id,
        auditionId: audition.id,
        promptPackId: promptPack?.id ?? null,
        comfyPromptId: comfyJob?.promptId ?? null,
        comfyError: comfyJob?.error ?? null,
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
