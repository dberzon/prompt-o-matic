import { z } from 'zod'
import { LocationBibleGeographySchema } from '../../../bibles/schemas/locationBible.schema.js'

/** LLM output slice — must match {@link LocationBibleGeographySchema}. */
export const LocationGeographyStageSchema = LocationBibleGeographySchema

export const LocationInhabitantsStageSchema = z
  .object({
    inhabitants: z.array(z.string()).default([]),
  })
  .strict()

/** Weather / sensory / fixtures / era line — Location Bible “history” slice. */
export const LocationHistoryStageSchema = z
  .object({
    eraOrPeriod: z.string().optional(),
    weather: z.string().optional(),
    sensoryAtmosphere: z.string().optional(),
    periodFixtures: z.array(z.string()).optional(),
  })
  .strict()
