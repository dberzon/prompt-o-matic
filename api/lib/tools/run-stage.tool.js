import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { StageCache } from '../extrapolation/stageCache.js'
import { runStage } from '../extrapolation/orchestrator.js'
import { tool } from './tool.js'

/**
 * @param {unknown} variables
 * @returns {Record<number, unknown>}
 */
function priorFromToolVariables(variables) {
  if (!variables || typeof variables !== 'object') return {}
  const p = /** @type {Record<string, unknown>} */ (variables).prior
  if (!p || typeof p !== 'object') return {}
  /** @type {Record<number, unknown>} */
  const out = {}
  for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (p))) {
    const n = Number.parseInt(String(k), 10)
    if (!Number.isNaN(n)) out[n] = v
  }
  return out
}

/** @type {{ db: import('better-sqlite3').Database | null; llm: import('../extrapolation/types.js').StageRunContext['llm'] | null; cache: import('../extrapolation/stageCache.js').StageCache | null; env: NodeJS.ProcessEnv | null }} */
let context = { db: null, llm: null, cache: null, env: null }

/**
 * @param {{
 *   db: import('better-sqlite3').Database
 *   llm: import('../extrapolation/types.js').StageRunContext['llm']
 *   cache?: import('../extrapolation/stageCache.js').StageCache
 *   env?: NodeJS.ProcessEnv
 * }} opts
 */
export function setRunStageContext({ db, llm, cache, env }) {
  context = { db, llm, cache: cache ?? null, env: env ?? null }
}

export function clearRunStageContext() {
  context = { db: null, llm: null, cache: null, env: null }
}

const inputSchema = z
  .object({
    entityId: z.string().min(1),
    stageId: z.coerce.number().int(),
    variables: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const attributeRowSchema = z.record(z.string(), z.unknown())

const outputSchema = z
  .object({
    ok: z.literal(true),
    attributes: z.array(attributeRowSchema),
    droppedItems: z.array(
      z.object({
        key: z.string().nullable(),
        reason: z.string(),
        raw: z.unknown().optional(),
      }),
    ),
  })
  .strict()

export default tool({
  name: 'run-stage',
  description:
    'Run a single extrapolation stage for an entity; persists attributes via the orchestrator write path. Optional variables.prior supplies prior stage outputs (numeric keys).',
  input: inputSchema,
  output: outputSchema,
  async handler(input) {
    if (!context.db) {
      throw new Error('run-stage tool: call setRunStageContext({ db, llm }) before invoke')
    }
    if (!context.llm) {
      throw new Error('run-stage tool: call setRunStageContext({ db, llm }) before invoke')
    }
    /** Shared on-disk default cache can return hits for another DB/entity with the same canon snapshot; isolate when unset. */
    let cache = context.cache
    let ephemeralCacheDir = null
    if (!cache) {
      ephemeralCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-run-stage-'))
      cache = new StageCache({ cacheDir: ephemeralCacheDir })
    }
    try {
      const result = await runStage({
        db: context.db,
        entityId: input.entityId,
        stageId: input.stageId,
        llm: context.llm,
        cache,
        prior: priorFromToolVariables(input.variables),
        env: context.env ?? process.env,
      })
      return {
        ok: true,
        attributes: result.writes || [],
        droppedItems: result.dropped || [],
      }
    } finally {
      if (ephemeralCacheDir) {
        try {
          fs.rmSync(ephemeralCacheDir, { recursive: true, force: true })
        } catch {
          // ignore
        }
      }
    }
  },
})
