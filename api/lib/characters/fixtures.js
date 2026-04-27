export const validCharacterProfile = {
  id: 'char_001',
  projectId: 'proj_audition_01',
  name: 'Elena',
  age: 24,
  apparentAgeRange: { min: 23, max: 26 },
  genderPresentation: 'female',
  ethnicityOrRegionalLook: 'mediterranean',
  faceShape: 'oval with soft jaw taper',
  eyes: 'almond hazel eyes with slight under-eye shadows',
  eyebrows: 'thick natural brows, slightly asymmetric',
  nose: 'straight bridge with rounded tip',
  lips: 'medium full lips with dry texture',
  jawline: 'subtle jawline with soft angle',
  cheekbones: 'moderate high cheekbones',
  skinTone: 'light olive',
  skinTexture: 'visible pores and faint freckles',
  hairColor: 'dark chestnut',
  hairLength: 'shoulder-length',
  hairTexture: 'wavy',
  hairstyle: 'loose middle-parted layers',
  bodyType: 'slim athletic',
  heightImpression: 'medium',
  posture: 'upright but relaxed shoulders',
  distinctiveFeatures: ['small scar near left eyebrow', 'faint smile line on right cheek'],
  wardrobeBase: 'worn gray wool coat over plain black knit top',
  cinematicArchetype: 'quiet observer',
  personalityEnergy: 'contained and alert',
  visualKeywords: ['natural skin', 'non-idealized', 'street-casting realism'],
  forbiddenSimilarities: ['existing actor bank id:char_013'],
  qwenPromptSeed: 'muted palette, practical textures',
  createdAt: '2026-04-26T18:00:00.000Z',
  updatedAt: '2026-04-26T18:05:00.000Z',
  approved: true,
}

export const invalidCharacterProfiles = {
  missingRequired: {
    id: 'char_bad_001',
    apparentAgeRange: { min: 23, max: 26 },
    createdAt: '2026-04-26T18:00:00.000Z',
    updatedAt: '2026-04-26T18:05:00.000Z',
  },
  invalidAge: {
    ...validCharacterProfile,
    id: 'char_bad_002',
    age: 121,
  },
  withUnknownKey: {
    ...validCharacterProfile,
    id: 'char_bad_003',
    unknownField: 'not allowed',
  },
}

export const validCharacterProfileOutside20to28 = {
  ...validCharacterProfile,
  id: 'char_older_001',
  age: 46,
  apparentAgeRange: { min: 44, max: 50 },
}

export const validCharacterGenerationRequest = {
  count: 30,
  ageMin: 20,
  ageMax: 28,
  genderPresentation: 'female',
  projectTone: 'cinematic audition casting',
  diversityRequirements: [
    'unique faces',
    'different hairstyles',
    'different body/posture energies',
  ],
  outputViews: [
    'front_portrait',
    'three_quarter_portrait',
    'profile_portrait',
    'full_body',
    'audition_still',
  ],
  candidateMultiplier: 2,
}

export const invalidCharacterGenerationRequests = {
  ageRangeInverted: {
    ...validCharacterGenerationRequest,
    ageMin: 30,
    ageMax: 25,
  },
  invalidAgeBounds: {
    ...validCharacterGenerationRequest,
    ageMin: 12,
    ageMax: 15,
  },
  missingViews: {
    ...validCharacterGenerationRequest,
    outputViews: [],
  },
}

export const validQwenImagePromptPack = {
  characterId: 'char_001',
  projectId: 'proj_audition_01',
  positivePrompt: 'woman in worn wool coat, static pose, overcast urban sidewalk, analog grain',
  negativePrompt: 'cgi, illustration, plastic skin',
  camera: 'eye-level medium portrait',
  lens: '50mm',
  framing: 'subject on left third, negative space right',
  lighting: 'flat overcast daylight',
  colorPalette: 'desaturated grays and olive tones',
  background: 'weathered concrete wall with subtle stains',
  wardrobe: 'worn gray wool coat and black knit top',
  pose: 'standing still with hands in coat pockets',
  expression: 'neutral, inward focus',
  aspectRatio: '3:4',
  consistencyTags: ['char_001', 'audition_set_a', 'front_portrait'],
  seedHint: 2147483,
  comfyWorkflowId: 'wf_qwen_audition_v1',
  createdAt: '2026-04-26T18:10:00.000Z',
}

export const validGeneratedImageRecord = {
  id: 'img_001',
  characterId: 'char_001',
  projectId: 'proj_audition_01',
  imagePath: '/images/proj_audition_01/char_001/front_001.png',
  thumbnailPath: '/images/proj_audition_01/char_001/front_001_thumb.png',
  promptPackId: 'pack_001',
  positivePrompt: 'woman in worn wool coat, static pose, overcast urban sidewalk, analog grain',
  negativePrompt: 'cgi, illustration, plastic skin',
  seed: 2147483,
  modelName: 'qwen-image-2512',
  workflowVersion: 'v1.0.0',
  viewType: 'front_portrait',
  approved: false,
  rejectedReason: 'eyes inconsistent with character profile',
  visualDescription: 'front portrait, shallow depth, muted concrete background',
  embeddingStatus: 'pending',
  createdAt: '2026-04-26T18:20:00.000Z',
}
