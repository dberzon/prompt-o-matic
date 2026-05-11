import { z } from 'zod'

const attributeSchema = z.object({
  key: z.string().trim().min(1),
  value: z.unknown(),
}).strict()

const entitySchema = z.object({
  slug: z.string().trim().min(1),
  type: z.enum(['character', 'environment', 'prop', 'institution']),
  name: z.string().trim().min(1),
  attributes: z.array(attributeSchema).default([]),
}).strict()

export const s1EntityExtractionSchema = z.object({
  primary: z.object({
    attributes: z.array(attributeSchema).default([]),
  }).default({ attributes: [] }),
  entities: z.array(entitySchema).default([]),
}).strict()

export function parseS1EntityExtractionOutput(raw) {
  return s1EntityExtractionSchema.parse(raw)
}
