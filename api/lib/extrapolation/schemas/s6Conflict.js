import { z } from 'zod'

/**
 * Single contradiction between two or more attributes.
 * Shape matches extrapolation.s6.conflict prompt, applyS6Parser, and EntityConflictPanel.
 */
export const ConflictSchema = z
  .object({
    key: z.string().min(1),
    message: z.string().min(1),
    attributeIds: z.array(z.string().min(1)).min(2),
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
