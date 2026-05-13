import { z } from 'zod'
import { recommended, required } from './_sectionMarkers.js'

const nonEmpty = z.string().min(1)

const demographicsInner = z
  .object({
    gender: nonEmpty,
    ageRange: nonEmpty,
    eraLabel: nonEmpty,
    housingNotes: z.string().optional(),
  })
  .strict()

const physicalInner = z
  .object({
    height: nonEmpty,
    build: nonEmpty,
    face: nonEmpty,
    eyes: nonEmpty,
    nose: nonEmpty,
    lips: nonEmpty,
    skin: nonEmpty,
  })
  .strict()

const wardrobeInner = z
  .object({
    everyday: z.string().optional(),
    accessories: z.array(z.string()).default([]),
  })
  .strict()

const voiceInner = z
  .object({
    dialogueDeliveryNotes: z.string().optional(),
    accentOrDiction: z.string().optional(),
  })
  .strict()

const psychologyInner = z
  .object({
    temperament: z.string().optional(),
    motivations: z.string().optional(),
  })
  .strict()

const historyInner = z
  .object({
    biographySummary: nonEmpty,
    educationOrWork: z.string().optional(),
    habits: z.string().optional(),
  })
  .strict()

const relationshipEntrySchema = z
  .object({
    slug: nonEmpty,
    label: nonEmpty,
    nature: nonEmpty,
  })
  .strict()

const visualsInner = z
  .object({
    portraitBrief: nonEmpty,
    continuityKeywords: z.array(z.string()).default([]),
  })
  .strict()

/**
 * Character Bible — single-character continuity document.
 *
 * Sections: demographics(required), physical(required), wardrobe(recommended),
 * voice(recommended), psychology(recommended), history(recommended),
 * relationships(default []), visuals(required)
 */
export const CharacterBibleSchema = z
  .object({
    demographics: required(demographicsInner),
    physical: required(physicalInner),
    wardrobe: recommended(wardrobeInner).optional(),
    voice: recommended(voiceInner).optional(),
    psychology: recommended(psychologyInner).optional(),
    history: recommended(historyInner).optional(),
    relationships: recommended(z.array(relationshipEntrySchema).default([])).default([]),
    visuals: required(visualsInner),
  })
  .strict()

/** @param {unknown} input */
export function parseCharacterBible(input) {
  return CharacterBibleSchema.parse(input)
}
