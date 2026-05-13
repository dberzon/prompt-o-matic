import { z } from 'zod'

const visualDescriptorInner = z
  .object({
    visualDescriptor: z.string().min(20).max(2000),
  })
  .strict()

const s5AlternateKey = z
  .object({
    'visual.descriptor': z.string(),
  })
  .strict()

const s5PrimaryKey = z
  .object({
    visualDescriptor: z.string(),
  })
  .strict()

/**
 * Normalizes legacy `visual.descriptor` key to `visualDescriptor` (matches `applyS5Parser`).
 */
export const S5VisualDescriptorOutputSchema = z.union([s5PrimaryKey, s5AlternateKey]).transform((data) => ({
  visualDescriptor: 'visualDescriptor' in data ? data.visualDescriptor : data['visual.descriptor'],
})).pipe(visualDescriptorInner)

/** @param {unknown} input */
export function parseS5VisualDescriptorOutput(input) {
  return S5VisualDescriptorOutputSchema.parse(input)
}
