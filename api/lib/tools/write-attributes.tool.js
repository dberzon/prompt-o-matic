import { z } from 'zod'
import { writeAttributesBatch } from '../repositories/attributes.js'
import { tool } from './tool.js'

/** @type {import('better-sqlite3').Database | null} */
let contextDb = null

/**
 * @param {{ db: import('better-sqlite3').Database }} opts
 */
export function setWriteAttributesDb({ db }) {
  contextDb = db
}

export function clearWriteAttributesDb() {
  contextDb = null
}

/** Input accepts mixed valid/invalid rows; per-row validation is in writeAttributesBatch. */
const inputSchema = z
  .object({
    entityId: z.string().min(1),
    attributes: z.array(z.record(z.string(), z.unknown())),
  })
  .strict()

const outputSchema = z
  .object({
    written: z.array(z.record(z.string(), z.unknown())),
    deduped: z.array(
      z.object({
        key: z.string(),
        value: z.unknown(),
        provenance: z.string(),
      }),
    ),
    rejected: z.array(
      z.object({
        index: z.number(),
        reason: z.string(),
        detail: z.unknown().optional(),
      }),
    ),
  })
  .strict()

export default tool({
  name: 'write-attributes',
  description: 'Batch-write entity attributes with provenance, dedupe, and per-row validation',
  input: inputSchema,
  output: outputSchema,
  handler(input) {
    if (!contextDb) {
      throw new Error('write-attributes tool: call setWriteAttributesDb({ db }) before invoke')
    }
    return writeAttributesBatch(contextDb, input)
  },
})
