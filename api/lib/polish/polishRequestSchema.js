import { z } from 'zod'

export const polishRequestSchema = z.object({
  fragments: z.array(z.string()).min(1),
  directorName: z.string().nullish(),
  directorNote: z.string().nullish(),
  scene: z.string().nullish(),
  scenario: z.string().nullish(),
  narrativeBeat: z.string().nullish(),
  frontPrefix: z.string().nullish(),
  engine: z.enum(['auto', 'local', 'cloud', 'embedded']).nullish(),
  localOnly: z.union([z.boolean(), z.string(), z.number()]).nullish(),
  localProvider: z.string().nullish(),
  cloudProvider: z.string().nullish(),
  lmStudioBaseUrl: z.string().nullish(),
  lmStudioModel: z.string().nullish(),
  mockResponse: z.string().nullish(),
  embeddedPort: z.union([z.number(), z.string()]).nullish(),
  embeddedSecret: z.string().nullish(),
  embeddedModel: z.string().nullish(),
  embeddedTimeoutMs: z.union([z.number(), z.string()]).nullish(),
  // entities.id is TEXT: default randomUUID() in createEntity when omitted, but callers
  // also pass slug-style ids (entity-lift-from-bank, S1/S4 parsers, POST /api/entities body.id).
  entityId: z.string().trim().min(1).max(128).nullish(),
  projectId: z.string().nullish(),
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
