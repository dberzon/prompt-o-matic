import { z } from 'zod'

const nonEmpty = z.string().min(1)

/**
 * Location Bible — structured continuity for a filming location.
 *
 * Sections: identity(required), geography(required), function(required),
 * weather(recommended), sensoryAtmosphere(recommended), periodFixtures(recommended),
 * inhabitants(default []), visuals(required)
 */
export const LocationBibleIdentitySchema = z
  .object({
    name: nonEmpty,
    eraOrPeriod: z.string().optional(),
    summary: nonEmpty,
  })
  .strict()

export const LocationBibleGeographySchema = z
  .object({
    placement: nonEmpty,
    architecturalNotes: z.string().optional(),
  })
  .strict()

export const LocationBibleFunctionSchema = z
  .object({
    purposeInStory: nonEmpty,
  })
  .strict()

export const LocationBibleVisualsSchema = z
  .object({
    shotPriority: nonEmpty,
    moodKeywords: z.array(z.string()).default([]),
  })
  .strict()

export const LocationBibleSchema = z
  .object({
    identity: LocationBibleIdentitySchema,
    geography: LocationBibleGeographySchema,
    function: LocationBibleFunctionSchema,
    visuals: LocationBibleVisualsSchema,
    weather: z.string().optional(),
    sensoryAtmosphere: z.string().optional(),
    periodFixtures: z.array(z.string()).optional(),
    inhabitants: z.array(z.string()).default([]),
  })
  .strict()

/** @param {unknown} input */
export function parseLocationBible(input) {
  return LocationBibleSchema.parse(input)
}
