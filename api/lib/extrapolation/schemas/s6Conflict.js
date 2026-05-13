import { z } from 'zod'

/** Single contradiction between two or more attribute keys. */
export const ConflictSchema = z
  .object({
    keys: z.array(z.string()).min(2),
    severity: z.enum(['low', 'medium', 'high']),
    reason: z.string(),
    suggested: z.string().optional(),
  })
  .strict()

export const S6ConflictOutputSchema = z
  .object({
    conflicts: z.array(ConflictSchema),
  })
  .strict()

/** @param {unknown} input */
export function parseS6ConflictOutput(input) {
  return S6ConflictOutputSchema.parse(input)
}
