import { z } from 'zod'
import { recommended, required } from './_sectionMarkers.js'

const nonEmpty = z.string().min(1)

const propIdentityInner = z
  .object({
    label: nonEmpty,
    summary: z.string().optional(),
  })
  .strict()

const propFunctionInner = z
  .object({
    purposeInStory: nonEmpty,
  })
  .strict()

const propVisualsInner = z
  .object({
    continuityNotes: nonEmpty,
    keywords: z.array(z.string()).default([]),
  })
  .strict()

const propOriginInner = z
  .object({
    notes: z.string().optional(),
    acquiredHow: z.string().optional(),
  })
  .strict()

/**
 * Prop Bible — object continuity for wardrobe / hand props / set dressing pieces.
 *
 * Sections: identity(required), function(required), origin(recommended),
 * wearPattern(recommended), narrativeRole(recommended), visuals(required)
 */
export const PropBibleSchema = z
  .object({
    identity: required(propIdentityInner),
    function: required(propFunctionInner),
    visuals: required(propVisualsInner),
    origin: recommended(propOriginInner).optional(),
    wearPattern: recommended(nonEmpty).optional(),
    narrativeRole: recommended(nonEmpty).optional(),
  })
  .strict()

/** @param {unknown} input */
export function parsePropBible(input) {
  return PropBibleSchema.parse(input)
}
