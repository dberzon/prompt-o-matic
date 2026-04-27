import { z } from 'zod'
import { getCharacter, listPromptPacks } from '../db/repositories.js'
import { compileCharacterPromptPacks } from '../prompts/qwenPromptCompiler.js'

const ViewEnum = z.enum([
  'front_portrait',
  'three_quarter_portrait',
  'profile_portrait',
  'full_body',
  'audition_still',
  'cinematic_scene',
])

const PortfolioRequestSchema = z.object({
  characterId: z.string().trim().min(1),
  views: z.array(ViewEnum).min(1),
  workflowId: z.string().trim().min(1).optional(),
  options: z.object({
    persistPromptPacks: z.boolean().default(true),
    aspectRatio: z.enum(['2:3', '3:4', '16:9', '1:1']).default('2:3'),
    styleProfile: z.string().trim().min(1).default('cinematic casting portrait'),
    includeNegativePrompt: z.boolean().default(true),
  }).default({}),
}).strict()

function findReusablePromptPack({ packs, view, workflowId, aspectRatio }) {
  return packs.find((pack) => {
    const hasView = Array.isArray(pack.consistencyTags) && pack.consistencyTags.includes(view)
    const workflowMatches = workflowId ? pack.comfyWorkflowId === workflowId : true
    const aspectMatches = aspectRatio ? pack.aspectRatio === aspectRatio : true
    return hasView && workflowMatches && aspectMatches
  }) || null
}

export function generateCharacterPortfolioPlan({
  db,
  characterId,
  views,
  workflowId,
  options = {},
}) {
  const parsed = PortfolioRequestSchema.parse({ characterId, views, workflowId, options })
  const character = getCharacter(db, parsed.characterId)
  if (!character) {
    const err = new Error('Character not found')
    err.status = 404
    throw err
  }
  const existingPacks = listPromptPacks(db, { characterId: parsed.characterId })
  const planItems = []
  for (const view of parsed.views) {
    const reusable = findReusablePromptPack({
      packs: existingPacks,
      view,
      workflowId: parsed.workflowId,
      aspectRatio: parsed.options.aspectRatio,
    })
    if (reusable) {
      planItems.push({
        view,
        promptPackId: reusable.id,
        source: 'reused',
        promptPack: reusable,
      })
      continue
    }
    const compiled = compileCharacterPromptPacks({
      db,
      input: {
        characterId: parsed.characterId,
        views: [view],
        options: {
          persist: parsed.options.persistPromptPacks !== false,
          aspectRatio: parsed.options.aspectRatio,
          styleProfile: parsed.options.styleProfile,
          includeNegativePrompt: parsed.options.includeNegativePrompt,
          comfyWorkflowId: parsed.workflowId,
        },
      },
    })
    const createdPack = compiled.packs[0]
    planItems.push({
      view,
      promptPackId: createdPack?.id || null,
      source: 'created',
      promptPack: createdPack || null,
    })
  }
  return {
    ok: true,
    characterId: parsed.characterId,
    workflowId: parsed.workflowId || null,
    options: parsed.options,
    totalViews: parsed.views.length,
    items: planItems,
  }
}

export async function queueCharacterPortfolio({
  db,
  comfyService,
  characterId,
  views,
  workflowId,
  options = {},
}) {
  const plan = generateCharacterPortfolioPlan({
    db,
    characterId,
    views,
    workflowId,
    options,
  })
  const queued = []
  for (const item of plan.items) {
    if (!item.promptPackId) {
      queued.push({
        view: item.view,
        promptPackId: null,
        ok: false,
        error: 'Missing prompt pack id in plan item',
      })
      continue
    }
    try {
      const result = await comfyService.queuePromptPackById({
        db,
        promptPackId: item.promptPackId,
        workflowId: workflowId || undefined,
        dryRun: false,
      })
      queued.push({
        view: item.view,
        promptPackId: item.promptPackId,
        source: item.source,
        ok: true,
        result,
      })
    } catch (error) {
      queued.push({
        view: item.view,
        promptPackId: item.promptPackId,
        source: item.source,
        ok: false,
        error: error?.message || 'Queue failed',
      })
    }
  }
  return {
    ok: true,
    characterId: plan.characterId,
    workflowId: plan.workflowId,
    planItems: plan.items,
    queued,
    summary: {
      total: queued.length,
      success: queued.filter((x) => x.ok).length,
      failed: queued.filter((x) => !x.ok).length,
    },
  }
}

