import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePromptFrontmatter } from './frontmatter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class PromptOverrideIdMismatchError extends Error {
  /**
   * @param {string} message
   * @param {{ filePath?: string; expectedId?: string; declaredId?: string }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'PromptOverrideIdMismatchError'
    this.filePath = meta.filePath
    this.expectedId = meta.expectedId
    this.declaredId = meta.declaredId
  }
}

/**
 * @param {unknown} slug
 * @returns {slug is string}
 */
export function isSafeProjectSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > 200) return false
  if (slug === '.' || slug === '..') return false
  return /^[a-zA-Z0-9._-]+$/.test(slug)
}

/**
 * @param {{ libraryDir?: string }} [opts]
 */
export function overridesRoot(opts = {}) {
  const lib = opts.libraryDir ?? path.join(__dirname, 'library')
  return path.join(lib, '_overrides')
}

/**
 * @param {string} root
 * @param {string} candidate
 * @returns {boolean}
 */
function isPathInsideRoot(root, candidate) {
  const r = path.resolve(root) + path.sep
  const c = path.resolve(candidate)
  return c === path.resolve(root) || c.startsWith(r)
}

/**
 * @param {string} projectSlug
 * @param {string} id
 * @param {string | undefined} version
 * @param {{ libraryDir?: string }} [opts]
 * @returns {string | null}
 */
export function resolveOverrideFilePath(projectSlug, id, version, opts = {}) {
  if (!isSafeProjectSlug(projectSlug) || typeof id !== 'string' || !id) return null
  const root = overridesRoot(opts)
  if (!isPathInsideRoot(root, path.join(root, projectSlug))) return null
  const base = path.join(root, projectSlug)
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return null

  const verStr = version !== undefined && version !== null && String(version).length > 0 ? String(version) : ''
  if (verStr) {
    const vPath = path.join(base, `${id}.v${verStr}.prompt.md`)
    if (fs.existsSync(vPath) && fs.statSync(vPath).isFile()) return vPath
  }
  const flatPath = path.join(base, `${id}.prompt.md`)
  if (fs.existsSync(flatPath) && fs.statSync(flatPath).isFile()) return flatPath
  return null
}

/**
 * @param {string} filePath
 * @param {string} expectedId
 * @returns {import('./registry.js').PromptRecord}
 */
export function readOverridePromptRecord(filePath, expectedId) {
  const contents = fs.readFileSync(filePath, 'utf8')
  const { meta, body } = parsePromptFrontmatter(contents, filePath)
  if (meta.id !== expectedId) {
    throw new PromptOverrideIdMismatchError(
      `Override prompt id mismatch in ${filePath}: frontmatter declares id "${meta.id}" but override path requires id "${expectedId}"`,
      { filePath, expectedId, declaredId: meta.id },
    )
  }
  return {
    id: meta.id,
    version: String(meta.version),
    description: meta.description,
    inputSchema: meta.inputSchema,
    outputSchema: meta.outputSchema,
    fewshot: meta.fewshot,
    provider: meta.provider,
    tags: meta.tags,
    body,
  }
}

/**
 * @param {string} projectSlug
 * @param {string} id
 * @param {string | undefined} version
 * @param {{ libraryDir?: string }} [opts]
 * @returns {{ record: import('./registry.js').PromptRecord; sourcePath: string } | null}
 */
export function tryLoadProjectOverride(projectSlug, id, version, opts = {}) {
  const filePath = resolveOverrideFilePath(projectSlug, id, version, opts)
  if (!filePath) return null
  return { record: readOverridePromptRecord(filePath, id), sourcePath: filePath }
}

/**
 * @param {string} projectSlug
 * @param {{ libraryDir?: string }} [opts]
 * @returns {Array<{ id: string; version: string; sourcePath: string }>}
 */
export function listOverrides(projectSlug, opts = {}) {
  if (!isSafeProjectSlug(projectSlug)) return []
  const root = overridesRoot(opts)
  const base = path.join(root, projectSlug)
  if (!isPathInsideRoot(root, base)) return []
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return []

  /** @type {Array<{ id: string; version: string; sourcePath: string }>} */
  const rows = []
  for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.prompt.md')) continue
    const sourcePath = path.join(base, ent.name)
    const contents = fs.readFileSync(sourcePath, 'utf8')
    const { meta } = parsePromptFrontmatter(contents, sourcePath)
    rows.push({ id: meta.id, version: String(meta.version), sourcePath })
  }
  rows.sort((a, b) => (a.id === b.id ? compareVersionDesc(a.version, b.version) : a.id < b.id ? -1 : 1))
  return rows
}

function compareVersionDesc(a, b) {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
    return nb - na
  }
  return a < b ? 1 : a > b ? -1 : 0
}
