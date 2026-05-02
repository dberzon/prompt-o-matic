/**
 * Builds an LLM prompt that expands a bank entry's free-text description into
 * N CharacterProfile JSON variants suitable for casting.
 *
 * @param {object} args
 * @param {object} args.bankEntry - { name, slug, description, optimizedDescription? }
 * @param {number} args.count - number of variants to request (1..10)
 * @returns {string} the user-message body
 */
export function buildBankEntryAuditionPrompt({ bankEntry, count }) {
  const description = (bankEntry.optimizedDescription || bankEntry.description || '').trim()
  const safeCount = Math.max(1, Math.min(10, Math.trunc(count) || 1))
  return [
    `You are casting actors for the role of: ${bankEntry.name} (@${bankEntry.slug}).`,
    '',
    'Character description:',
    `"${description}"`,
    '',
    `Generate ${safeCount} distinct actor candidate profiles that could plausibly portray this character. Each candidate must match the description but vary in:`,
    '- specific facial features (faceShape, eye color, hair color/texture)',
    '- specific posture and personality energy',
    '- subtle age variation within the implied range',
    '',
    `Return a strict JSON array of exactly ${safeCount} objects. Each object must contain these required fields:`,
    '- age (integer 16-100)',
    '- apparentAgeRange ({ min: integer, max: integer }, with min<=max, both 16-100)',
    '- faceShape, eyes, eyebrows, nose, lips, jawline, skinTone (each non-empty string)',
    '- hairColor, hairLength, hairTexture, hairstyle (each non-empty string)',
    '- bodyType, heightImpression, posture (each non-empty string)',
    '- wardrobeBase, cinematicArchetype, personalityEnergy (each non-empty string)',
    '- distinctiveFeatures (array of non-empty strings, length >= 1)',
    '- visualKeywords (array of non-empty strings, length >= 1)',
    '',
    'Optional fields you may include: genderPresentation, ethnicityOrRegionalLook, cheekbones, skinTexture.',
    '',
    'Do NOT include id, createdAt, updatedAt, embeddingStatus — those will be filled server-side.',
    '',
    'Return JSON array only. No prose. No markdown fences.',
  ].join('\n')
}
