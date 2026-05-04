import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const isoDateTime = z.string().datetime({ offset: true })
const viewTypeEnum = z.enum([
  'front_portrait',
  'three_quarter_portrait',
  'profile_portrait',
  'full_body',
  'audition_still',
  'cinematic_scene',
  'other',
])
const embeddingStatusEnum = z.enum(['pending', 'embedded', 'failed', 'not_indexed'])

const ageRangeSchema = z.object({
  min: z.number().int().min(16).max(100),
  max: z.number().int().min(16).max(100),
}).refine((value) => value.min <= value.max, {
  message: 'apparentAgeRange.min must be <= apparentAgeRange.max',
})

export const CharacterProfileSchema = z.object({
  id: nonEmpty,
  projectId: nonEmpty.optional(),
  name: nonEmpty.optional(),
  age: z.number().int().min(16).max(100),
  apparentAgeRange: ageRangeSchema,
  genderPresentation: nonEmpty.optional(),
  ethnicityOrRegionalLook: nonEmpty.optional(),
  faceShape: nonEmpty,
  eyes: nonEmpty,
  eyebrows: nonEmpty,
  nose: nonEmpty,
  lips: nonEmpty,
  jawline: nonEmpty,
  cheekbones: nonEmpty.optional(),
  skinTone: nonEmpty,
  skinTexture: nonEmpty.optional(),
  hairColor: nonEmpty,
  hairLength: nonEmpty,
  hairTexture: nonEmpty,
  hairstyle: nonEmpty,
  bodyType: nonEmpty,
  heightImpression: nonEmpty,
  posture: nonEmpty,
  distinctiveFeatures: z.array(nonEmpty).min(1),
  wardrobeBase: nonEmpty,
  cinematicArchetype: nonEmpty,
  personalityEnergy: nonEmpty,
  visualKeywords: z.array(nonEmpty).min(1),
  forbiddenSimilarities: z.array(nonEmpty).optional(),
  qwenPromptSeed: nonEmpty.optional(),
  embeddingStatus: embeddingStatusEnum.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  approved: z.boolean().optional(),
  lifecycleStatus: z.enum(['draft', 'auditioned', 'portfolio_pending', 'ready', 'finalized']).optional(),
})

export const QwenImagePromptPackSchema = z.object({
  id: nonEmpty.optional(),
  characterId: nonEmpty,
  projectId: nonEmpty.optional(),
  positivePrompt: nonEmpty,
  negativePrompt: nonEmpty,
  camera: nonEmpty,
  lens: nonEmpty.optional(),
  framing: nonEmpty,
  lighting: nonEmpty,
  colorPalette: nonEmpty,
  background: nonEmpty,
  wardrobe: nonEmpty,
  pose: nonEmpty,
  expression: nonEmpty,
  aspectRatio: z.enum(['2:3', '3:4', '16:9', '1:1']),
  consistencyTags: z.array(nonEmpty),
  seedHint: z.number().int().optional(),
  comfyWorkflowId: nonEmpty.optional(),
  createdAt: isoDateTime,
}).strict()

export const GeneratedImageRecordSchema = z.object({
  id: nonEmpty,
  characterId: nonEmpty.optional(),
  projectId: nonEmpty.optional(),
  imagePath: nonEmpty,
  thumbnailPath: nonEmpty.optional(),
  promptPackId: nonEmpty,
  positivePrompt: nonEmpty,
  negativePrompt: nonEmpty,
  seed: z.number().int().optional(),
  modelName: nonEmpty,
  workflowVersion: nonEmpty.optional(),
  viewType: viewTypeEnum,
  approved: z.boolean(),
  rejectedReason: nonEmpty.optional(),
  visualDescription: nonEmpty.optional(),
  embeddingStatus: z.enum(['pending', 'embedded', 'failed']).optional(),
  comfyImage: z.object({
    filename: nonEmpty,
    subfolder: z.string().default(''),
    type: z.string().default('output'),
  }).optional(),
  createdAt: isoDateTime,
}).strict()

export const CharacterGenerationRequestSchema = z.object({
  count: z.number().int().min(1).max(100),
  ageMin: z.number().int().min(16).max(100),
  ageMax: z.number().int().min(16).max(100),
  genderPresentation: nonEmpty.optional(),
  projectTone: nonEmpty.optional(),
  diversityRequirements: z.array(nonEmpty).default([]),
  outputViews: z.array(viewTypeEnum).min(1),
  candidateMultiplier: z.number().int().min(1).max(10).default(2),
}).refine((value) => value.ageMin <= value.ageMax, {
  message: 'ageMin must be <= ageMax',
}).strict()

export function parseCharacterProfile(input) {
  return CharacterProfileSchema.parse(input)
}

export function parseQwenImagePromptPack(input) {
  return QwenImagePromptPackSchema.parse(input)
}

export function parseGeneratedImageRecord(input) {
  return GeneratedImageRecordSchema.parse(input)
}

export function parseCharacterGenerationRequest(input) {
  return CharacterGenerationRequestSchema.parse(input)
}

export const CharacterBankEntrySchema = z.object({
  id: nonEmpty,
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'slug must be snake_case ASCII'),
  name: nonEmpty,
  description: nonEmpty,
  optimizedDescription: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}).strict()

export function parseCharacterBankEntry(input) {
  return CharacterBankEntrySchema.parse(input)
}

export const ActorCandidateSchema = z.object({
  id: nonEmpty,
  status: z.enum(['available', 'archived']),
  sourceBankEntryId: nonEmpty.optional(),
  promptPackId: nonEmpty.optional(),
  notes: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}).strict()

export function parseActorCandidate(input) {
  return ActorCandidateSchema.parse(input)
}

export const ActorAuditionSchema = z.object({
  id: nonEmpty,
  actorCandidateId: nonEmpty,
  bankEntryId: nonEmpty,
  status: z.enum(['pending', 'approved', 'rejected']),
  rejectedReason: z.string().optional(),
  similarityScore: z.number().optional(),
  notes: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}).strict()

export function parseActorAudition(input) {
  return ActorAuditionSchema.parse(input)
}
