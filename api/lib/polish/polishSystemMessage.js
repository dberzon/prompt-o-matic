import { EntityNotFoundError, projectBibleNested } from '../bibles/projection.js'
import { getPrompt } from '../prompts/registry.js'
import { renderPrompt } from '../prompts/render.js'

/** @type {readonly string[]} */
export const POLISH_BIBLE_INJECT_PATHS = [
  'demographics.gender',
  'demographics.ageRange',
  'demographics.eraLabel',
  'demographics.housingNotes',
  'physical.height',
  'physical.build',
  'physical.face',
  'physical.eyes',
  'physical.nose',
  'physical.lips',
  'physical.skin',
  'wardrobe.everyday',
  'wardrobe.accessories',
  'voice.dialogueDeliveryNotes',
  'voice.accentOrDiction',
  'psychology.temperament',
  'psychology.motivations',
  'history.biographySummary',
  'history.educationOrWork',
  'history.habits',
  'visuals.portraitBrief',
  'visuals.continuityKeywords',
]

const BIBLE_BLOCK_HEADER = `### Character Bible Reference
Use the following attributes as authoritative ground truth for this character.`

/** @type {string | null} */
let polishV1RenderedCache = null

export function getPolishV1RenderedBody() {
  if (polishV1RenderedCache == null) {
    const rec = getPrompt('polish.system')
    polishV1RenderedCache = renderPrompt(rec.body, {})
  }
  return polishV1RenderedCache
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyInjectValue(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatInjectValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ')
  }
  return String(value).trim()
}

/**
 * @param {Record<string, unknown>} nested
 * @param {string} dotPath
 * @returns {unknown}
 */
function lookupNestedPath(nested, dotPath) {
  const keys = dotPath.split('.').filter(Boolean)
  let cur = /** @type {unknown} */ (nested)
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = /** @type {Record<string, unknown>} */ (cur)[key]
  }
  return cur
}

/**
 * @param {Record<string, unknown>} nested
 * @returns {string | null}
 */
export function formatPolishBibleContextBlock(nested) {
  const lines = []
  for (const path of POLISH_BIBLE_INJECT_PATHS) {
    const value = lookupNestedPath(nested, path)
    if (isEmptyInjectValue(value)) continue
    lines.push(`- ${path}: ${formatInjectValue(value)}`)
  }
  if (lines.length === 0) return null
  return `${BIBLE_BLOCK_HEADER}\n\n${lines.join('\n')}`
}

/**
 * @param {{ db?: import('better-sqlite3').Database | null, entityId?: string | null }} [options]
 * @returns {string}
 */
export function buildPolishSystemMessage({ db = null, entityId = null } = {}) {
  const baseline = getPolishV1RenderedBody()
  const trimmedId = typeof entityId === 'string' ? entityId.trim() : ''
  if (!trimmedId || !db) return baseline

  let nested
  try {
    nested = projectBibleNested(db, trimmedId)
  } catch (err) {
    if (err instanceof EntityNotFoundError) return baseline
    throw err
  }

  const block = formatPolishBibleContextBlock(/** @type {Record<string, unknown>} */ (nested))
  if (!block) return baseline
  return `${baseline}\n\n${block}`
}
