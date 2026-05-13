import { z } from 'zod'
import { LlmStructuredError } from './errors.js'

/**
 * @param {string} text
 * @returns {{ ok: true; value: unknown } | { ok: false; message: string }}
 */
function tryJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

/**
 * @param {import('zod').ZodTypeAny} schema
 * @param {unknown} value
 * @param {(info: { key: string; reason: string }) => void} [onDrop]
 */
function parseWithArrayDrops(schema, value, onDrop) {
  const direct = schema.safeParse(value)
  if (direct.success) return direct.data

  if (Array.isArray(value) && schema instanceof z.ZodArray) {
    const elem = schema.element
    /** @type {unknown[]} */
    const kept = []
    for (let i = 0; i < value.length; i++) {
      const row = value[i]
      const rowResult = elem.safeParse(row)
      if (rowResult.success) {
        kept.push(rowResult.data)
      } else {
        onDrop?.({ key: String(i), reason: rowResult.error.message })
      }
    }
    const again = schema.safeParse(kept)
    if (again.success) return again.data
    throw new LlmStructuredError('Schema validation failed after dropping invalid array items', {
      issues: again.error.issues,
      rawText: typeof value === 'string' ? value : JSON.stringify(value),
    })
  }

  throw new LlmStructuredError('Schema validation failed', {
    issues: direct.error.issues,
    rawText: typeof value === 'string' ? value : JSON.stringify(value),
  })
}

/**
 * @param {{
 *   client: { chat: (args: Record<string, unknown>) => Promise<string> }
 *   promptId: string
 *   version?: string
 *   variables?: Record<string, unknown>
 *   schema: import('zod').ZodTypeAny
 *   maxRetries?: number
 *   onDrop?: (info: { key: string; reason: string }) => void
 * }} opts
 */
export async function callWithSchema({
  client,
  promptId,
  version,
  variables = {},
  schema,
  maxRetries = 1,
  onDrop,
}) {
  let rawText = ''
  /** @type {import('zod').ZodIssue[]} */
  let lastIssues = []

  const attempts = maxRetries + 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    const vars =
      attempt === 0
        ? variables
        : { ...variables, structuredOutputRepair: { rawText, issues: lastIssues } }

    rawText = String(await client.chat({ promptId, version, variables: vars, schema }))

    const trimmed = rawText.trim()
    const json = tryJsonParse(trimmed)
    if (!json.ok) {
      lastIssues = [{ code: 'custom', message: json.message, path: [] }]
      if (attempt === attempts - 1) {
        throw new LlmStructuredError('Invalid JSON after retries', { issues: lastIssues, rawText })
      }
      continue
    }

    try {
      return parseWithArrayDrops(schema, json.value, onDrop)
    } catch (e) {
      if (e instanceof LlmStructuredError) {
        lastIssues = e.issues
        if (attempt === attempts - 1) {
          throw new LlmStructuredError(e.message, { issues: e.issues, rawText })
        }
        continue
      }
      throw e
    }
  }

  throw new LlmStructuredError('Exhausted structured output retries', { issues: lastIssues, rawText })
}
