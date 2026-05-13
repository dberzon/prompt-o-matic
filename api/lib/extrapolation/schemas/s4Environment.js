import { z } from 'zod'

const environmentEntitySchema = z
  .object({
    name: z.string().min(1),
    summary: z.string().optional(),
  })
  .strict()

/** Matches `relationshipAttributes` payloads consumed by `applyS4Parser`. */
export const relationshipAttributeSchema = z
  .object({
    type: z.string().min(1),
    otherSlug: z.string().min(1),
    value: z.any(),
    confidence: z.number().optional(),
  })
  .strict()

const flatAttributeSchema = z
  .object({
    key: z.string().min(1),
    value: z.any(),
    confidence: z.number().optional(),
  })
  .strict()

/**
 * S4 environment projection LLM output (superset of prompt contract: includes
 * `attributes` and `relationshipAttributes` used by `applyS4Parser`).
 */
export const S4EnvironmentOutputSchema = z
  .object({
    environments: z.array(environmentEntitySchema),
    attributes: z.array(flatAttributeSchema).optional(),
    relationshipAttributes: z.array(relationshipAttributeSchema).optional(),
  })
  .strict()

/** @param {unknown} input */
export function parseS4EnvironmentOutput(input) {
  return S4EnvironmentOutputSchema.parse(input)
}
