import { z } from 'zod'

const psychologyKey = z.string().regex(/^(behavior|speech|fear)\..+/)

export const psychologyAttributeSchema = z
  .object({
    key: psychologyKey,
    value: z.any(),
    confidence: z.number().optional(),
  })
  .strict()
  .refine((data) => data.value !== undefined, { path: ['value'], message: 'Required' })

export const S3PsychologyOutputSchema = z
  .object({
    attributes: z.array(psychologyAttributeSchema),
  })
  .strict()

/** @param {unknown} input */
export function parseS3PsychologyOutput(input) {
  return S3PsychologyOutputSchema.parse(input)
}
