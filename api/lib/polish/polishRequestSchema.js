import { z } from 'zod'

export const polishRequestSchema = z.object({
  fragments: z.array(z.string()).min(1),
  directorName: z.string().optional(),
  directorNote: z.string().optional(),
  scene: z.string().optional(),
  scenario: z.string().optional(),
  narrativeBeat: z.string().optional(),
  frontPrefix: z.string().optional(),
  engine: z.enum(['auto', 'local', 'cloud', 'embedded']).optional(),
  localOnly: z.union([z.boolean(), z.string(), z.number()]).optional(),
  localProvider: z.string().optional(),
  cloudProvider: z.string().optional(),
  lmStudioBaseUrl: z.string().optional(),
  lmStudioModel: z.string().optional(),
  mockResponse: z.string().optional(),
  embeddedPort: z.union([z.number(), z.string()]).optional(),
  embeddedSecret: z.string().optional(),
  embeddedModel: z.string().optional(),
  embeddedTimeoutMs: z.union([z.number(), z.string()]).optional(),
  // entities.id is TEXT: default randomUUID() in createEntity when omitted, but callers
  // also pass slug-style ids (entity-lift-from-bank, S1/S4 parsers, POST /api/entities body.id).
  entityId: z.string().trim().min(1).max(128).optional(),
  projectId: z.string().optional(),
})

/**
 * @param {unknown} raw
 * @returns {{ ok: true, data: z.infer<typeof polishRequestSchema> } | { ok: false, error: z.ZodError }}
 */
export function parsePolishRequest(raw) {
  const parsed = polishRequestSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error }
  return { ok: true, data: parsed.data }
}
