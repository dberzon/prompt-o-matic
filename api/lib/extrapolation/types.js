/**
 * @typedef {Object} StageRunContext
 * @property {string} entityId
 * @property {import('better-sqlite3').Database} db
 * @property {(args: { system: string, user: string, providerPayload?: object }) => Promise<string>} llm
 * @property {string} modelId
 * @property {import('./stageCache.js').StageCache} cache
 * @property {Record<number, object>} prior
 */

/**
 * @typedef {Object} StageRunResult
 * @property {Array<object>} writes
 * @property {Array<object>} suggestions
 * @property {Array<object>} [conflicts]
 * @property {Array<{ key: string | null, reason: string, raw?: unknown }>} [dropped]
 * @property {unknown} raw
 */

/**
 * @typedef {Object} ExtrapolationStage
 * @property {number} id
 * @property {string} name
 * @property {(ctx: StageRunContext) => Promise<StageRunResult>} run
 */

export const STAGE_IDS = [1, 2, 3, 4, 5, 6]
