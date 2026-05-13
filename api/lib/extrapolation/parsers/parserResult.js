/**
 * @typedef {{ key: string | null; reason: string; raw?: unknown }} ParserDropped
 */

/**
 * @template T
 * @typedef {{
 *   accepted: T[]
 *   dropped: ParserDropped[]
 *   suggestions?: unknown[]
 *   conflicts?: unknown[]
 * }} ParserResult
 */

export {}
