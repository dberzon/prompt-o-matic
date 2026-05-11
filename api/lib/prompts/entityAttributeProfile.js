const PROMPT_PACK_PROVENANCES = new Set(['canon', 'inferred', 'derived'])
const DERIVED_RELATION_PREFIX = 'relation.'

const PROVENANCE_RANK = {
  canon: 0,
  inferred: 1,
  derived: 2,
}

const ATTRIBUTE_KEY_ALIASES = {
  wardrobe: 'wardrobeBase',
  'visual.descriptor': 'visualDescriptor',
}

const FACIAL_ATTRIBUTE_KEYS = new Set([
  'faceShape',
  'eyes',
  'eyebrows',
  'nose',
  'lips',
  'jawline',
  'cheekbones',
  'skinTone',
  'skinTexture',
  'hairColor',
  'hairLength',
  'hairTexture',
  'hairstyle',
  'distinctiveFeatures',
])

const PROFILE_FIELDS = new Set([
  'age',
  'genderPresentation',
  'faceShape',
  'eyes',
  'eyebrows',
  'nose',
  'lips',
  'jawline',
  'cheekbones',
  'skinTone',
  'skinTexture',
  'hairColor',
  'hairLength',
  'hairTexture',
  'hairstyle',
  'bodyType',
  'heightImpression',
  'posture',
  'wardrobeBase',
  'cinematicArchetype',
  'personalityEnergy',
  'qwenPromptSeed',
  'projectId',
])

const ENTITY_PROFILE_DEFAULTS = {
  age: 25,
  genderPresentation: 'unspecified gender presentation',
  faceShape: 'unspecified face shape',
  eyes: 'unspecified eyes',
  eyebrows: 'unspecified eyebrows',
  nose: 'unspecified nose',
  lips: 'unspecified lips',
  jawline: 'unspecified jawline',
  skinTone: 'unspecified skin tone',
  hairColor: 'unspecified hair color',
  hairLength: 'unspecified hair length',
  hairTexture: 'unspecified hair texture',
  hairstyle: 'unspecified hairstyle',
  bodyType: 'unspecified body type',
  heightImpression: 'unspecified height impression',
  posture: 'neutral posture',
  wardrobeBase: 'unspecified wardrobe',
  distinctiveFeatures: ['unspecified distinctive features'],
  cinematicArchetype: 'unspecified archetype',
  personalityEnergy: 'neutral energy',
  qwenPromptSeed: 'natural muted cinematic palette',
}

function parseDistinctiveFeatures(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {}
  }
  return trimmed.split(/[,;]\s*/).map((item) => item.trim()).filter(Boolean)
}

function resolveAttributeField(key) {
  return ATTRIBUTE_KEY_ALIASES[key] || key
}

function applyAttributeValue(profile, field, value) {
  if (field === 'visualDescriptor') {
    profile.visualDescriptor = value
    return
  }
  if (field === 'age') {
    const parsed = Number.parseInt(String(value).trim(), 10)
    if (Number.isFinite(parsed)) {
      profile.age = parsed
    }
    return
  }
  if (field === 'distinctiveFeatures') {
    const parsed = parseDistinctiveFeatures(value)
    if (parsed.length > 0) {
      profile.distinctiveFeatures = parsed
    }
    return
  }
  if (PROFILE_FIELDS.has(field)) {
    profile[field] = value
  }
}

function parseDerivedRelationKey(key) {
  if (!key || !key.startsWith(DERIVED_RELATION_PREFIX)) return null
  const rest = key.slice(DERIVED_RELATION_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon < 0) return null
  return {
    relationType: rest.slice(0, colon),
    otherEntityId: rest.slice(colon + 1),
  }
}

function derivedAttributeInScope(attribute, scopeEntityIds = []) {
  if (attribute.provenance !== 'derived') return true
  const relation = parseDerivedRelationKey(attribute.key)
  if (!relation) return false
  const scope = new Set(scopeEntityIds)
  return scope.has(relation.otherEntityId)
}

export function selectAttributesForPromptPack(attributes, { scopeEntityIds = [] } = {}) {
  const byKey = new Map()
  for (const attribute of attributes) {
    if (!PROMPT_PACK_PROVENANCES.has(attribute.provenance)) continue
    if (!derivedAttributeInScope(attribute, scopeEntityIds)) continue
    const existing = byKey.get(attribute.key)
    if (!existing) {
      byKey.set(attribute.key, attribute)
      continue
    }
    const nextRank = PROVENANCE_RANK[attribute.provenance] ?? 99
    const existingRank = PROVENANCE_RANK[existing.provenance] ?? 99
    if (nextRank < existingRank) {
      byKey.set(attribute.key, attribute)
    }
  }
  return byKey
}

export function selectAttributesForReferencePortrait(attributes) {
  const selected = selectAttributesForPromptPack(attributes)
  const visualDescriptor = selected.get('visual.descriptor')
  const facialByKey = new Map()

  for (const attribute of attributes) {
    if (!PROMPT_PACK_PROVENANCES.has(attribute.provenance)) continue
    const field = resolveAttributeField(attribute.key)
    if (!FACIAL_ATTRIBUTE_KEYS.has(field)) continue
    const existing = facialByKey.get(attribute.key)
    if (!existing) {
      facialByKey.set(attribute.key, attribute)
      continue
    }
    const nextRank = PROVENANCE_RANK[attribute.provenance] ?? 99
    const existingRank = PROVENANCE_RANK[existing.provenance] ?? 99
    if (nextRank < existingRank) {
      facialByKey.set(attribute.key, attribute)
    }
  }

  const attributeByKey = new Map(facialByKey)
  if (visualDescriptor) {
    attributeByKey.set('visual.descriptor', visualDescriptor)
  }
  return attributeByKey
}

export function entityAttributesToProfile(entity, attributeByKey) {
  const profile = {
    id: entity.id,
    name: entity.name,
    ...ENTITY_PROFILE_DEFAULTS,
  }
  const extraContext = []

  for (const [key, attribute] of attributeByKey.entries()) {
    const field = resolveAttributeField(key)
    if (field === 'visualDescriptor' || PROFILE_FIELDS.has(field) || field === 'distinctiveFeatures' || field === 'age') {
      applyAttributeValue(profile, field, attribute.value)
      continue
    }
    extraContext.push(`${key}: ${attribute.value}`)
  }

  return {
    profile,
    visualDescriptor: profile.visualDescriptor,
    extraContext,
  }
}

export function entityAttributesToReferencePortraitProfile(entity, attributeByKey) {
  const { profile, visualDescriptor } = entityAttributesToProfile(entity, attributeByKey)
  return {
    profile,
    visualDescriptor,
  }
}
