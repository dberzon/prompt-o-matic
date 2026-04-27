import { z } from 'zod'
import { parseCharacterProfile, parseQwenImagePromptPack } from '../characters/schemas.js'
import { createPromptPack, getCharacter, listBatchCandidates, listPromptPacks } from '../db/repositories.js'
import { buildNegativePrompt } from './negativePromptLibrary.js'

const ViewEnum = z.enum([
  'front_portrait',
  'three_quarter_portrait',
  'profile_portrait',
  'full_body',
  'audition_still',
  'cinematic_scene',
  'other',
])

const CompileCharacterSchema = z.object({
  characterId: z.string().trim().min(1).optional(),
  character: z.unknown().optional(),
  views: z.array(ViewEnum).min(1).default(['front_portrait']),
  options: z.object({
    persist: z.boolean().optional(),
    aspectRatio: z.enum(['2:3', '3:4', '16:9', '1:1']).default('2:3'),
    styleProfile: z.string().trim().min(1).default('cinematic casting portrait'),
    includeNegativePrompt: z.boolean().default(true),
    comfyWorkflowId: z.string().trim().min(1).optional(),
  }).default({}),
}).strict().refine((v) => Boolean(v.characterId) || Boolean(v.character), {
  message: 'Provide characterId or character',
})

const CompileBatchSchema = z.object({
  batchId: z.string().trim().min(1),
  candidateStatus: z.enum(['saved', 'approved', 'pending']).default('saved'),
  views: z.array(ViewEnum).min(1).default(['front_portrait']),
  options: z.object({
    persist: z.boolean().default(true),
    aspectRatio: z.enum(['2:3', '3:4', '16:9', '1:1']).default('2:3'),
    styleProfile: z.string().trim().min(1).default('cinematic casting portrait'),
    includeNegativePrompt: z.boolean().default(true),
    comfyWorkflowId: z.string().trim().min(1).optional(),
  }).default({}),
}).strict()

function viewRules(view) {
  const rules = {
    front_portrait: {
      camera: 'eye-level frontal portrait',
      lens: '50mm',
      framing: 'head and shoulders, direct camera angle',
      lighting: 'soft key light, neutral fill',
      pose: 'neutral still posture',
      expression: 'calm neutral expression',
      background: 'simple studio wall or plain textured room',
    },
    three_quarter_portrait: {
      camera: 'eye-level three-quarter portrait angle',
      lens: '50mm',
      framing: 'head and upper torso at 3/4 face angle',
      lighting: 'soft directional key with subtle shadow definition',
      pose: 'slight shoulder turn, stable posture',
      expression: 'neutral controlled expression',
      background: 'subtle interior texture, non-distracting',
    },
    profile_portrait: {
      camera: 'strict side profile portrait',
      lens: '85mm',
      framing: 'clean side silhouette from head to upper torso',
      lighting: 'single directional side light defining nose lips jawline',
      pose: 'head turned full profile, still posture',
      expression: 'neutral expression with relaxed jaw',
      background: 'clean matte background with tonal contrast',
    },
    full_body: {
      camera: 'full body portrait framing',
      lens: '35mm',
      framing: 'full figure visible from head to feet',
      lighting: 'natural balanced room light',
      pose: 'neutral full-body standing posture',
      expression: 'natural casting neutral expression',
      background: 'simple environment with readable floor and wall',
    },
    audition_still: {
      camera: 'audition still camera setup',
      lens: '50mm',
      framing: 'mid-shot to medium portrait for casting review',
      lighting: 'practical room light, realistic low-contrast setup',
      pose: 'performance-ready but still',
      expression: 'focused audition-ready expression',
      background: 'simple rehearsal room or plain room interior',
    },
    cinematic_scene: {
      camera: 'cinematic medium shot composition',
      lens: '40mm',
      framing: 'character integrated with surrounding scene context',
      lighting: 'motivated practical light with directional depth',
      pose: 'identity-preserving still pose in scene context',
      expression: 'subtle dramatic restraint',
      background: 'atmospheric environment consistent with tone',
    },
    other: {
      camera: 'neutral portrait camera setup',
      lens: '50mm',
      framing: 'identity-preserving portrait framing',
      lighting: 'soft realistic light',
      pose: 'still neutral pose',
      expression: 'neutral expression',
      background: 'minimal non-distracting background',
    },
  }
  return rules[view] || rules.other
}

function buildPositivePrompt(character, view, styleProfile) {
  const r = viewRules(view)
  return [
    `${styleProfile}`,
    `character identity: ${character.name || character.id}, age ${character.age}, ${character.genderPresentation || 'unspecified gender presentation'}`,
    `facial structure: ${character.faceShape}, ${character.eyes}, ${character.eyebrows}, ${character.nose}, ${character.lips}, ${character.jawline}`,
    `skin and hair: ${character.skinTone}${character.skinTexture ? `, ${character.skinTexture}` : ''}, ${character.hairColor}, ${character.hairLength}, ${character.hairTexture}, ${character.hairstyle}`,
    `body and posture: ${character.bodyType}, ${character.heightImpression}, ${character.posture}`,
    `wardrobe: ${character.wardrobeBase}`,
    `distinctive features: ${character.distinctiveFeatures.join(', ')}`,
    `camera: ${r.camera}, lens: ${r.lens}, framing: ${r.framing}`,
    `lighting: ${r.lighting}`,
    `pose: ${r.pose}, expression: ${r.expression}`,
    `background: ${r.background}`,
    `personality energy: ${character.personalityEnergy}, archetype: ${character.cinematicArchetype}`,
    'photorealistic, shot on film, analog photography, imperfect natural surfaces, not cgi, not illustrated',
  ].join(', ')
}

function buildPackForView({ character, view, options }) {
  const rules = viewRules(view)
  const resolvedOptions = {
    aspectRatio: options?.aspectRatio || '2:3',
    styleProfile: options?.styleProfile || 'cinematic casting portrait',
    includeNegativePrompt: options?.includeNegativePrompt !== false,
    comfyWorkflowId: options?.comfyWorkflowId,
  }
  const pack = {
    characterId: character.id,
    projectId: character.projectId,
    positivePrompt: buildPositivePrompt(character, view, resolvedOptions.styleProfile),
    negativePrompt: buildNegativePrompt({ include: resolvedOptions.includeNegativePrompt, view }),
    camera: rules.camera,
    lens: rules.lens,
    framing: rules.framing,
    lighting: rules.lighting,
    colorPalette: character.qwenPromptSeed || 'natural muted cinematic palette',
    background: rules.background,
    wardrobe: character.wardrobeBase,
    pose: rules.pose,
    expression: rules.expression,
    aspectRatio: resolvedOptions.aspectRatio,
    consistencyTags: [character.id, view, 'qwen-image-2512', 'identity-lock'],
    seedHint: undefined,
    comfyWorkflowId: resolvedOptions.comfyWorkflowId,
    createdAt: new Date().toISOString(),
  }
  return parseQwenImagePromptPack(pack)
}

export function compileCharacterPromptPacks({ db, input }) {
  const parsed = CompileCharacterSchema.parse(input)
  const characterRaw = parsed.characterId ? getCharacter(db, parsed.characterId) : parsed.character
  if (!characterRaw) {
    const err = new Error('Character not found')
    err.status = 404
    throw err
  }
  const character = parseCharacterProfile(characterRaw)
  const persist = typeof parsed.options.persist === 'boolean'
    ? parsed.options.persist
    : Boolean(parsed.characterId)

  const packs = parsed.views.map((view) => buildPackForView({
    character,
    view,
    options: parsed.options,
  }))

  const persisted = []
  if (persist) {
    for (const pack of packs) {
      persisted.push(createPromptPack(db, pack))
    }
  }

  return {
    ok: true,
    characterId: character.id,
    persisted: persist,
    packs: persist ? persisted : packs,
  }
}

function selectCandidatesByStatus(candidates, status) {
  if (status === 'saved') return candidates.filter((c) => c.reviewStatus === 'saved')
  if (status === 'approved') return candidates.filter((c) => c.reviewStatus === 'approved' || c.reviewStatus === 'saved')
  return candidates.filter((c) => c.reviewStatus === 'pending' || c.reviewStatus === 'approved' || c.reviewStatus === 'saved')
}

export function compileBatchPromptPacks({ db, input }) {
  const parsed = CompileBatchSchema.parse(input)
  const allCandidates = listBatchCandidates(db, parsed.batchId)
  const selected = selectCandidatesByStatus(allCandidates, parsed.candidateStatus)
  const results = []

  for (const item of selected) {
    const character = parseCharacterProfile(item.candidate)
    for (const view of parsed.views) {
      const pack = buildPackForView({
        character,
        view,
        options: parsed.options,
      })
      if (parsed.options.persist) {
        results.push(createPromptPack(db, pack))
      } else {
        results.push(pack)
      }
    }
  }

  return {
    ok: true,
    batchId: parsed.batchId,
    candidateStatus: parsed.candidateStatus,
    persisted: parsed.options.persist,
    totalPacks: results.length,
    packs: results,
  }
}

export function listPromptPacksForCharacter({ db, characterId }) {
  if (!characterId) {
    const err = new Error('Missing characterId')
    err.status = 400
    throw err
  }
  return {
    ok: true,
    characterId,
    items: listPromptPacks(db, { characterId }),
  }
}
