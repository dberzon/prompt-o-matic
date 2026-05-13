import { z } from 'zod'

export const historicalAttributeSchema = z
  .object({
    key: z.string().min(1),
    value: z.any(),
    confidence: z.number().optional(),
  })
  .strict()
  .refine((data) => data.value !== undefined, { path: ['value'], message: 'Required' })

export const S2HistoricalOutputSchema = z
  .object({
    attributes: z.array(historicalAttributeSchema),
  })
  .strict()

/** @param {unknown} input */
export function parseS2HistoricalOutput(input) {
  return S2HistoricalOutputSchema.parse(input)
}
