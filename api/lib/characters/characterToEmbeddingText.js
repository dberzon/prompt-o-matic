/**
 * Builds a deterministic embedding text representation.
 * Keep field order stable so embeddings are reproducible.
 */
export function characterToEmbeddingText(character) {
  const safeList = (value) => Array.isArray(value) ? value : []
  const apparentAgeRange = character?.apparentAgeRange
  const apparentAgeRangeText = apparentAgeRange && typeof apparentAgeRange === 'object'
    ? `${apparentAgeRange.min}-${apparentAgeRange.max}`
    : String(apparentAgeRange ?? '')

  return [
    `Age: ${character.age}`,
    `Apparent age range: ${apparentAgeRangeText}`,
    `Face shape: ${character.faceShape}`,
    `Eyes: ${character.eyes}`,
    `Eyebrows: ${character.eyebrows}`,
    `Nose: ${character.nose}`,
    `Lips: ${character.lips}`,
    `Jawline: ${character.jawline}`,
    `Skin tone: ${character.skinTone}`,
    `Hair: ${character.hairColor}, ${character.hairLength}, ${character.hairTexture}, ${character.hairstyle}`,
    `Body type: ${character.bodyType}`,
    `Height impression: ${character.heightImpression}`,
    `Posture: ${character.posture}`,
    `Distinctive features: ${safeList(character.distinctiveFeatures).join(', ')}`,
    `Wardrobe base: ${character.wardrobeBase}`,
    `Cinematic archetype: ${character.cinematicArchetype}`,
    `Personality energy: ${character.personalityEnergy}`,
    `Visual keywords: ${safeList(character.visualKeywords).join(', ')}`,
  ].join('\n')
}
