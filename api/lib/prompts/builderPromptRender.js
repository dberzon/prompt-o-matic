import { randomUUID } from 'node:crypto'
import { createCharacter, createPromptPack } from '../db/repositories.js'

const DEFAULT_ASPECT_RATIO = '2:3'
const SUPPORTED_ASPECT_RATIOS = new Set(['2:3', '3:4', '16:9', '1:1'])

function nowIso() {
  return new Date().toISOString()
}

function buildPreviewCharacter(characterId) {
  const createdAt = nowIso()
  return {
    id: characterId,
    name: 'Prompt Builder preview',
    age: 30,
    apparentAgeRange: { min: 28, max: 32 },
    faceShape: 'neutral oval face',
    eyes: 'neutral eyes',
    eyebrows: 'natural eyebrows',
    nose: 'straight nose',
    lips: 'natural lips',
    jawline: 'soft jawline',
    skinTone: 'neutral skin tone',
    hairColor: 'dark brown',
    hairLength: 'medium',
    hairTexture: 'straight',
    hairstyle: 'simple hairstyle',
    bodyType: 'average build',
    heightImpression: 'medium',
    posture: 'relaxed posture',
    distinctiveFeatures: ['prompt builder preview subject'],
    wardrobeBase: 'neutral wardrobe',
    cinematicArchetype: 'scene subject',
    personalityEnergy: 'still and observant',
    visualKeywords: ['prompt builder render'],
    lifecycleStatus: 'preview',
    createdAt,
    updatedAt: createdAt,
  }
}

export function buildPromptBuilderPromptPack({
  characterId,
  positivePrompt,
  negativePrompt,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  workflowId,
  seedHint,
}) {
  const createdAt = nowIso()
  const resolvedAspectRatio = SUPPORTED_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : DEFAULT_ASPECT_RATIO
  return {
    id: randomUUID(),
    characterId,
    positivePrompt: String(positivePrompt || '').trim(),
    negativePrompt: String(negativePrompt || '').trim(),
    camera: 'cinematic still frame',
    lens: '50mm',
    framing: 'balanced composition',
    lighting: 'motivated natural light',
    colorPalette: 'grounded cinematic palette',
    background: 'scene environment from prompt',
    wardrobe: 'wardrobe from prompt',
    pose: 'static pose',
    expression: 'neutral expression',
    aspectRatio: resolvedAspectRatio,
    consistencyTags: [characterId, 'prompt_builder', 'cinematic_scene'],
    ...(Number.isInteger(seedHint) ? { seedHint } : {}),
    ...(workflowId ? { comfyWorkflowId: workflowId } : {}),
    createdAt,
  }
}

export async function queuePromptBuilderRender({
  db,
  comfyService,
  positivePrompt,
  negativePrompt,
  aspectRatio,
  workflowId,
  seed,
  dryRun = false,
  allowWorkflowFallback = true,
}) {
  const trimmedPrompt = String(positivePrompt || '').trim()
  if (!trimmedPrompt) {
    const err = new Error('positivePrompt is required')
    err.status = 400
    throw err
  }

  const characterId = randomUUID()
  const character = createCharacter(db, buildPreviewCharacter(characterId))
  const promptPack = createPromptPack(db, buildPromptBuilderPromptPack({
    characterId,
    positivePrompt: trimmedPrompt,
    negativePrompt,
    aspectRatio,
    workflowId,
    seedHint: Number.isInteger(seed) ? seed : undefined,
  }))

  const queued = await comfyService.queuePromptPack({
    promptPack,
    seed,
    workflowId,
    dryRun,
    allowWorkflowFallback,
    db,
    entityId: characterId,
  })

  return {
    characterId: character.id,
    promptPackId: promptPack.id,
    viewType: 'cinematic_scene',
    ...queued,
  }
}
