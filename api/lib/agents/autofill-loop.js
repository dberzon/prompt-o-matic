import { detectEntityBibleGaps } from '../bibles/detectGaps.js'
import { runStage } from '../extrapolation/orchestrator.js'
import { StageCache } from '../extrapolation/stageCache.js'
import { writeAttributesBatch } from '../repositories/attributes.js'

/**
 * @param {unknown} gap
 * @returns {string}
 */
function gapWorkingKey(gap) {
  if (!gap || typeof gap !== 'object') return 'unknown'
  const g = /** @type {{ field?: unknown, suggestedStageId?: unknown }} */ (gap)
  const field = typeof g.field === 'string' ? g.field : 'unknown'
  const sid = g.suggestedStageId == null ? 'none' : String(g.suggestedStageId)
  return `${field}:${sid}`
}

/**
 * @param {unknown[]} writes
 * @returns {Array<{ key: string, value: unknown, provenance: string, confidence?: number | null, sourceStage?: number | string | null }>}
 */
function rowsForWriteBatch(writes) {
  if (!Array.isArray(writes)) return []
  /** @type {Array<{ key: string, value: unknown, provenance: string, confidence?: number | null, sourceStage?: number | string | null }>} */
  const out = []
  for (const w of writes) {
    if (!w || typeof w !== 'object') continue
    const row = /** @type {Record<string, unknown>} */ (w)
    if (typeof row.key !== 'string' || !row.key) continue
    if (typeof row.provenance !== 'string') continue
    out.push({
      key: row.key,
      value: row.value,
      provenance: row.provenance,
      confidence: /** @type {number | null | undefined} */ (row.confidence),
      sourceStage: /** @type {number | string | null | undefined} */ (row.sourceStage),
    })
  }
  return out
}

/**
 * @param {{ system?: string, user?: string }} args
 * @param {string} responseText
 */
function defaultTokenEstimate(args, responseText) {
  const s = String(args.system ?? '').length
  const u = String(args.user ?? '').length
  const r = String(responseText ?? '').length
  return Math.max(1, Math.ceil((s + u + r) / 4))
}

/**
 * Bounded Bible autofill loop: detect gaps → pick one → run extrapolation stage → batch-write attributes.
 *
 * @param {{
 *   db: import('better-sqlite3').Database
 *   entityId: string
 *   llm: import('../extrapolation/types.js').StageRunContext['llm']
 *   maxIterations?: number
 *   budgetTokens?: number
 *   onEvent?: (e: Record<string, unknown> & { type: string }) => void
 *   env?: NodeJS.ProcessEnv
 *   cache?: import('../extrapolation/stageCache.js').StageCache
 *   detectGaps?: typeof detectEntityBibleGaps
 *   meterLlmCall?: (args: { system: string, user: string, response: string }) => number
 *   shouldCancel?: () => boolean
 * }} opts
 * @returns {Promise<{
 *   iterations: number
 *   gapsResolved: number
 *   gapsRemaining: number
 *   terminationReason: 'complete' | 'budget' | 'max-iterations' | 'cancelled'
 * }>}
 */
export async function runAutofillLoop({
  db,
  entityId,
  llm,
  maxIterations = 6,
  budgetTokens,
  onEvent,
  env = process.env,
  cache = new StageCache(),
  detectGaps = detectEntityBibleGaps,
  meterLlmCall,
  shouldCancel,
}) {
  /** @param {Record<string, unknown> & { type: string }} e */
  const emit = (e) => {
    if (typeof onEvent === 'function') onEvent(e)
  }

  let spentTokens = 0

  const wrappedLlm = /** @type {import('../extrapolation/types.js').StageRunContext['llm']} */ (
    async (args) => {
      const text = await llm(args)
      const responseText = typeof text === 'string' ? text : String(text ?? '')
      const cost = meterLlmCall
        ? meterLlmCall({
            system: String(args.system ?? ''),
            user: String(args.user ?? ''),
            response: responseText,
          })
        : defaultTokenEstimate(args, responseText)
      spentTokens += cost
      return text
    }
  )

  let iterations = 0
  let gapsResolved = 0
  /** @type {Set<string>} */
  const skipped = new Set()

  emit({ type: 'run:start', entityId, kind: 'autofill-bible' })

  while (true) {
      if (typeof shouldCancel === 'function' && shouldCancel()) {
        const gapsRemaining = detectGaps(db, entityId).length
        emit({
          type: 'run:end',
          cancelled: true,
          terminationReason: 'cancelled',
          iterations,
          gapsResolved,
          gapsRemaining,
        })
        return { iterations, gapsResolved, gapsRemaining, terminationReason: 'cancelled' }
      }

      const gapsAll = detectGaps(db, entityId)
      const gapsRemaining = gapsAll.length

      if (gapsAll.length === 0) {
        emit({
          type: 'run:end',
          cancelled: false,
          terminationReason: 'complete',
          iterations,
          gapsResolved,
          gapsRemaining: 0,
        })
        return { iterations, gapsResolved, gapsRemaining: 0, terminationReason: 'complete' }
      }

      const actionable = gapsAll.filter((g) => !skipped.has(gapWorkingKey(g)))
      if (actionable.length === 0) {
        emit({
          type: 'run:end',
          cancelled: false,
          terminationReason: 'complete',
          iterations,
          gapsResolved,
          gapsRemaining,
        })
        return { iterations, gapsResolved, gapsRemaining, terminationReason: 'complete' }
      }

      if (iterations >= maxIterations) {
        emit({
          type: 'run:end',
          cancelled: false,
          terminationReason: 'max-iterations',
          iterations,
          gapsResolved,
          gapsRemaining,
        })
        return { iterations, gapsResolved, gapsRemaining, terminationReason: 'max-iterations' }
      }

      if (budgetTokens != null && spentTokens >= budgetTokens) {
        emit({
          type: 'run:end',
          cancelled: false,
          terminationReason: 'budget',
          iterations,
          gapsResolved,
          gapsRemaining,
        })
        return { iterations, gapsResolved, gapsRemaining, terminationReason: 'budget' }
      }

      const gap = actionable[0]
      const gapKey = gapWorkingKey(gap)
      iterations += 1

      emit({
        type: 'iter:start',
        iteration: iterations,
        entityId,
        gap: { field: gap.field, suggestedStageId: gap.suggestedStageId },
      })

      const stageId = gap.suggestedStageId
      if (stageId == null || !Number.isFinite(Number(stageId))) {
        skipped.add(gapKey)
        emit({ type: 'iter:end', iteration: iterations, ok: false, reason: 'no-suggested-stage' })
        continue
      }

      let stageResult
      try {
        stageResult = await runStage({
          db,
          entityId,
          stageId: Number(stageId),
          llm: wrappedLlm,
          cache,
          prior: {},
          env,
        })
      } catch {
        skipped.add(gapKey)
        emit({ type: 'iter:end', iteration: iterations, ok: false, reason: 'run-stage-failed' })
        continue
      }

      if (typeof shouldCancel === 'function' && shouldCancel()) {
        const gr = detectGaps(db, entityId).length
        emit({
          type: 'run:end',
          cancelled: true,
          terminationReason: 'cancelled',
          iterations,
          gapsResolved,
          gapsRemaining: gr,
        })
        return { iterations, gapsResolved, gapsRemaining: gr, terminationReason: 'cancelled' }
      }

      const batchRows = rowsForWriteBatch(stageResult.writes || [])
      try {
        writeAttributesBatch(db, { entityId, attributes: batchRows })
      } catch {
        skipped.add(gapKey)
        emit({ type: 'iter:end', iteration: iterations, ok: false, reason: 'write-attributes-failed' })
        continue
      }

      if (budgetTokens != null && spentTokens >= budgetTokens) {
        emit({ type: 'iter:end', iteration: iterations, ok: true, budgetExhausted: true })
        const gr = detectGaps(db, entityId).length
        emit({
          type: 'run:end',
          cancelled: false,
          terminationReason: 'budget',
          iterations,
          gapsResolved,
          gapsRemaining: gr,
        })
        return { iterations, gapsResolved, gapsRemaining: gr, terminationReason: 'budget' }
      }

      const still = detectGaps(db, entityId)
      const stillHasThisField = still.some((g) => g.field === gap.field)
      if (!stillHasThisField) {
        gapsResolved += 1
      } else {
        skipped.add(gapKey)
      }

      emit({ type: 'iter:end', iteration: iterations, ok: true })
    }
}
