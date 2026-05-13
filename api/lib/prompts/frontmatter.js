import { z } from 'zod'

/**
 * Minimal YAML subset: `key: value` per line; `tags` may be `a, b` or empty.
 * Multi-line block scalars are not supported.
 */
export const PromptFrontmatterSchema = z
  .object({
    id: z.string().min(1),
    version: z.coerce.string().min(1),
    description: z.string().min(1),
    inputSchema: z.string().optional(),
    outputSchema: z.string().optional(),
    fewshot: z.string().optional(),
    provider: z.string().optional(),
    tags: z
      .string()
      .optional()
      .transform((s) =>
        s === undefined || s === ''
          ? []
          : s
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
      ),
  })
  .strict()

/**
 * @param {string} raw
 * @returns {Record<string, string>}
 */
export function parseSimpleYaml(raw) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    out[key] = value
  }
  return out
}

/**
 * @param {string} filePath
 * @param {string} contents
 */
export function splitPromptFile(contents, filePath = '') {
  const text = String(contents ?? '')
  let rest
  let nl = '\n'
  if (text.startsWith('---\r\n')) {
    rest = text.slice(5)
    nl = '\r\n'
  } else if (text.startsWith('---\n')) {
    rest = text.slice(4)
  } else {
    throw new Error(`Missing YAML frontmatter (expected leading --- newline) in ${filePath}`)
  }
  const endMarker = `${nl}---${nl}`
  const endIdx = rest.indexOf(endMarker)
  if (endIdx === -1) {
    throw new Error(`Unclosed frontmatter (missing closing ---) in ${filePath}`)
  }
  const fm = rest.slice(0, endIdx)
  const body = rest.slice(endIdx + endMarker.length)
  return { frontmatterText: fm, body }
}

/**
 * @param {string} filePath
 * @param {string} contents
 */
export function parsePromptFrontmatter(contents, filePath = '') {
  const { frontmatterText, body } = splitPromptFile(contents, filePath)
  const yamlish = parseSimpleYaml(frontmatterText)
  const parsed = PromptFrontmatterSchema.safeParse(yamlish)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')
    throw new Error(`Invalid prompt frontmatter in ${filePath}: ${msg}`)
  }
  return { meta: parsed.data, body }
}
