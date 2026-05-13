/**
 * Builds the system prompt for expanding a bank entry into N CharacterProfile JSON variants.
 *
 * @param {object} args
 * @param {object} args.bankEntry - { name, slug, description, optimizedDescription? }
 * @param {number} args.count - number of variants to request (1..10)
 * @returns {string} the system-message body
 */
export function buildBankEntryAuditionSystemPrompt({ bankEntry, count }) {
  const description = (bankEntry.optimizedDescription || bankEntry.description || '').trim()
  const safeCount = Math.max(1, Math.min(10, Math.trunc(count) || 1))

  return `You are an expert casting director and character visualization specialist for AI text-to-image pipelines. Your task is to generate ${safeCount} distinct actor candidate profiles that could plausibly portray the following role while remaining optimized for photorealistic image generation.

Character: ${bankEntry.name} (@${bankEntry.slug})
Core Description: "${description}"

CASTING PRINCIPLES:
- Maintain strict fidelity to the core description, but vary each candidate across facial architecture, physical presence, hair styling, posture, and subtle age/energy expression.
- All descriptors must be concrete, observable, and physically measurable. Avoid abstract mood terms (e.g., "charming", "mysterious", "intense", "brooding"). Translate energy into posture, gaze direction, facial tension, or habitual stance.
- Each profile must function as a visual blueprint for consistent character generation. Prioritize anatomical precision, lighting-ready features, and cinematic framing compatibility.
- Vary candidates systematically: shift face shape/bone structure, eye shape/color, hair texture/style, body proportion, posture/weight distribution, and apparent age within the implied range. Do not alter core identity markers required by the description.

REQUIRED JSON STRUCTURE:
Return a strict JSON array of exactly ${safeCount} objects. Each object must contain ONLY these fields:
- age (integer, 16-100): precise casting age
- apparentAgeRange ({ "min": integer, "max": integer }, both 16-100, min <= max): visual age span the actor can portray
- faceShape, eyes, eyebrows, nose, lips, jawline, skinTone (non-empty strings): anatomically precise, material descriptors
- hairColor, hairLength, hairTexture, hairstyle (non-empty strings): specific, render-ready terms
- bodyType, heightImpression, posture (non-empty strings): proportional and habitual stance descriptors
- wardrobeBase, cinematicArchetype, personalityEnergy (non-empty strings): wardrobe foundation, framing archetype, energy translated to physical behavior/gaze/posture
- distinctiveFeatures (array of 1-3 non-empty strings): unique but plausible physical markers
- visualKeywords (array of 1-4 non-empty strings): T2I-optimized terms for consistent rendering

STRICT OUTPUT RULES:
- Output ONLY the raw JSON array. Zero preamble, zero markdown, zero code fences, zero explanations.
- The output must start exactly with [ and end exactly with ].
- Do NOT include id, createdAt, updatedAt, embeddingStatus, or any extra fields.
- Ensure valid JSON syntax: double-quoted keys and string values, proper commas, matching braces/brackets.
- All string values must be concise (1-4 words), non-redundant, and physically grounded.
- Validate that min <= max in apparentAgeRange and all ages fall within 16-100.

Generate the JSON array now.`
}
