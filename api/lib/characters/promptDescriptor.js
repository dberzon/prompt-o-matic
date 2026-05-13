import { resolveProviderSelection, runWithResolvedProvider } from '../polishCore.js'
import { getCharacter, updateCharacter } from '../db/repositories.js'

export const DESCRIPTOR_SYSTEM_PROMPT = `You are a casting director writing a concise visual description for a film production call sheet. Given a character profile, produce a 15–25 word description that includes ONLY:
- Age and gender presentation
- The 2–3 most visually distinctive physical features (face structure, hair, eyes, build)
- One clothing item if it is a signature element

STRICT CONSTRAINTS:
- Do NOT include: mood, personality, lighting, color palette, film stock, texture, composition, background, abstract descriptors, or emotional labels of any kind.
- All descriptors must be concrete, observable, and physically measurable.
- Write in lowercase comma-separated fragments, not sentences.
- The description must make this person visually distinguishable from any other person of the same age and gender.
- If this descriptor will be used for image generation, it must be T2I-ready: material-specific, rendering-friendly, free of vague terms.

Output ONLY the descriptor text. Zero preamble, zero quotes, zero explanation.`

function buildDescriptorUserMessage(character) {
  const lines = []
  if (character.name) lines.push(`Name: ${character.name}`)
  if (typeof character.age === 'number') lines.push(`Age: ${character.age}`)
  if (character.genderPresentation) lines.push(`Gender presentation: ${character.genderPresentation}`)
  if (character.ethnicityOrRegionalLook) lines.push(`Ethnicity/regional look: ${character.ethnicityOrRegionalLook}`)
  const physical = []
  if (character.faceShape) physical.push(`face shape: ${character.faceShape}`)
  if (character.eyes) physical.push(`eyes: ${character.eyes}`)
  if (character.eyebrows) physical.push(`eyebrows: ${character.eyebrows}`)
  if (character.nose) physical.push(`nose: ${character.nose}`)
  if (character.lips) physical.push(`lips: ${character.lips}`)
  if (character.jawline) physical.push(`jawline: ${character.jawline}`)
  if (character.cheekbones) physical.push(`cheekbones: ${character.cheekbones}`)
  if (character.skinTone) physical.push(`skin tone: ${character.skinTone}`)
  if (character.skinTexture) physical.push(`skin texture: ${character.skinTexture}`)
  if (physical.length) lines.push(`Physical features: ${physical.join('; ')}`)
  const hair = []
  if (character.hairColor) hair.push(character.hairColor)
  if (character.hairLength) hair.push(character.hairLength)
  if (character.hairTexture) hair.push(character.hairTexture)
  if (character.hairstyle) hair.push(character.hairstyle)
  if (hair.length) lines.push(`Hair: ${hair.join(', ')}`)
  const body = []
  if (character.bodyType) body.push(character.bodyType)
  if (character.heightImpression) body.push(character.heightImpression)
  if (character.posture) body.push(character.posture)
  if (body.length) lines.push(`Build: ${body.join(', ')}`)
  if (character.wardrobeBase) lines.push(`Wardrobe: ${character.wardrobeBase}`)
  if (Array.isArray(character.distinctiveFeatures) && character.distinctiveFeatures.length) {
    lines.push(`Distinctive features: ${character.distinctiveFeatures.join(', ')}`)
  }
  if (Array.isArray(character.visualKeywords) && character.visualKeywords.length) {
    lines.push(`Visual keywords: ${character.visualKeywords.join(', ')}`)
  }
  lines.push('')
  lines.push('Write the descriptor now.')
  return lines.join('\n')
}

export async function backfillCharacterPromptDescriptors({ db, fetchImpl = fetch, env = process.env, delayMs = 500 } = {}) {
  const rows = db.prepare('SELECT id FROM characters WHERE prompt_descriptor IS NULL AND slug IS NOT NULL').all()
  let processed = 0
  let failed = 0
  for (const row of rows) {
    try {
      await generateCharacterPromptDescriptor({ db, characterId: row.id, fetchImpl, env })
      processed++
    } catch (err) {
      console.warn('[backfill-descriptor] failed for', row.id, err?.message)
      failed++
    }
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return { processed, failed }
}

export function setCharacterPromptDescriptor(db, characterId, descriptor) {
  if (!characterId) {
    const err = new Error('Missing characterId')
    err.status = 400
    throw err
  }
  const trimmed = String(descriptor ?? '').trim().slice(0, 150)
  const character = getCharacter(db, characterId)
  if (!character) {
    const err = new Error('Character not found')
    err.status = 404
    throw err
  }
  return updateCharacter(db, characterId, { promptDescriptor: trimmed })
}

export async function generateCharacterPromptDescriptor({
  db,
  characterId,
  fetchImpl = fetch,
  env = process.env,
  save = true,
}) {
  if (!characterId) {
    const err = new Error('Missing characterId')
    err.status = 400
    throw err
  }
  const character = getCharacter(db, characterId)
  if (!character) {
    const err = new Error('Character not found')
    err.status = 404
    throw err
  }

  const userMessage = buildDescriptorUserMessage(character)
  const providerSelection = await resolveProviderSelection({
    engine: 'auto',
    fetchImpl,
    env,
    payload: {},
  })

  const raw = await runWithResolvedProvider({
    provider: providerSelection.provider,
    userMessage,
    payload: {},
    fetchImpl,
    env,
    systemPrompt: DESCRIPTOR_SYSTEM_PROMPT,
  })

  const descriptor = String(raw ?? '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\r?\n+/g, ' ')
    .trim()

  if (!descriptor) {
    const err = new Error('LLM returned empty descriptor')
    err.status = 502
    throw err
  }

  if (save) {
    updateCharacter(db, characterId, { promptDescriptor: descriptor })
  }

  return {
    promptDescriptor: descriptor,
    provider: providerSelection.provider,
    engine: providerSelection.resolvedFrom,
  }
}
