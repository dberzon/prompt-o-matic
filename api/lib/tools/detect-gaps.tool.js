import { z } from 'zod'
import { detectEntityBibleGaps } from '../bibles/detectGaps.js'
import { tool } from './tool.js'

/** @type {import('better-sqlite3').Database | null} */
let contextDb = null

/**
 * @param {{ db: import('better-sqlite3').Database }} opts
 */
export function setDetectGapsDb({ db }) {
  contextDb = db
}

export function clearDetectGapsDb() {
  contextDb = null
}

const inputSchema = z.object({ entityId: z.string().min(1) }).strict()

const gapSchema = z.object({
  field: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'error']),
  suggestedStageId: z.number().int().positive().nullable(),
})

const outputSchema = z.object({ gaps: z.array(gapSchema) }).strict()

export default tool({
  name: 'detect-gaps',
  description: 'List Bible-style completeness gaps for an entity (minimal projection; stage hints when known)',
  input: inputSchema,
  output: outputSchema,
  async handler(input) {
    if (!contextDb) {
      throw new Error('detect-gaps tool: call setDetectGapsDb({ db }) before invoke')
    }
    const gaps = detectEntityBibleGaps(contextDb, input.entityId)
    return { gaps }
  },
})
