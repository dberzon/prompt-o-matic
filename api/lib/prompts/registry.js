import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePromptFrontmatter } from './frontmatter.js'
import { tryLoadProjectOverride } from './overrides.js'

export { listOverrides, PromptOverrideIdMismatchError } from './overrides.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class PromptNotFoundError extends Error {
  /** @param {string} id */
  constructor(id) {
    super(`Prompt not found: ${id}`)
    this.name = 'PromptNotFoundError'
    this.id = id
  }
}

/**
 * @typedef {{
 *   id: string
 *   version: string
 *   description: string
 *   inputSchema?: string
 *   outputSchema?: string
 *   fewshot?: string
 *   provider?: string
 *   tags?: string[]
 *   body: string
 * }} PromptRecord
 */

/**
 * @param {string} dir
 * @param {(name: string) => boolean} filter
 * @returns {string[]}
 */
function walkFiles(dir, filter) {
  if (!fs.existsSync(dir)) {
    return []
  }
  /** @type {string[]} */
  const out = []
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === '_overrides') continue
      out.push(...walkFiles(full, filter))
    } else if (name.isFile() && filter(name.name)) {
      out.push(full)
    }
  }
  return out
}

function compareVersionDesc(a, b) {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
    return nb - na
  }
  return a < b ? 1 : a > b ? -1 : 0
}

/**
 * @param {{ libraryDir?: string }} [opts]
 * @returns {Map<string, Map<string, PromptRecord>>}
 */
export function loadRegistry({ libraryDir = path.join(__dirname, 'library') } = {}) {
  /** @type {Map<string, Map<string, PromptRecord>>} */
  const byId = new Map()
  const files = walkFiles(libraryDir, (n) => n.endsWith('.prompt.md'))
  for (const filePath of files) {
    const contents = fs.readFileSync(filePath, 'utf8')
    const { meta, body } = parsePromptFrontmatter(contents, filePath)
    /** @type {PromptRecord} */
    const record = {
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
    if (!byId.has(record.id)) {
      byId.set(record.id, new Map())
    }
    byId.get(record.id).set(record.version, record)
  }
  return byId
}

/** @type {Map<string, Map<string, PromptRecord>>|null} */
let defaultRegistry = null

function getDefaultRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = loadRegistry()
  }
  return defaultRegistry
}

/**
 * @typedef {{ version?: string; projectSlug?: string; libraryDir?: string }} GetPromptOptions
 */

/**
 * @param {string} id
 * @param {string | Map<string, Map<string, PromptRecord>> | GetPromptOptions | undefined} [second]
 * @param {Map<string, Map<string, PromptRecord>> | undefined} [third]
 */
export function getPrompt(id, second, third) {
  /** @type {Map<string, Map<string, PromptRecord>> | undefined} */
  let reg
  /** @type {string | undefined} */
  let ver

  if (second instanceof Map) {
    reg = second
    ver = undefined
  } else if (second !== undefined && second !== null && typeof second === 'object' && !Array.isArray(second)) {
    const opts = /** @type {GetPromptOptions} */ (second)
    if (opts.version !== undefined && opts.version !== null) {
      const s = String(opts.version)
      ver = s.length ? s : undefined
    }
    reg = third
    const slugRaw = opts.projectSlug
    const projectSlug = typeof slugRaw === 'string' && slugRaw.trim().length > 0 ? slugRaw.trim() : ''
    if (projectSlug) {
      const oDir = opts.libraryDir
      const loaded = tryLoadProjectOverride(projectSlug, id, ver, oDir ? { libraryDir: oDir } : {})
      if (loaded) {
        return loaded.record
      }
    }
  } else if (second !== undefined && second !== null) {
    const s = String(second)
    ver = s.length ? s : undefined
    reg = third
  } else {
    reg = third
  }

  reg ??= getDefaultRegistry()
  const versions = reg.get(id)
  if (!versions || versions.size === 0) {
    throw new PromptNotFoundError(id)
  }
  if (ver) {
    const rec = versions.get(String(ver))
    if (!rec) {
      throw new PromptNotFoundError(`${id}@${ver}`)
    }
    return rec
  }
  const ordered = [...versions.keys()].sort(compareVersionDesc)
  const pick = ordered[0]
  return /** @type {PromptRecord} */ (versions.get(pick))
}

/**
 * @param {Map<string, Map<string, PromptRecord>>} [registry]
 */
export function listPrompts(registry = getDefaultRegistry()) {
  /** @type {Array<{ id: string; version: string; description: string; tags?: string[] }>} */
  const rows = []
  for (const [id, versions] of registry.entries()) {
    for (const [version, rec] of versions.entries()) {
      rows.push({ id, version, description: rec.description, tags: rec.tags })
    }
  }
  rows.sort((a, b) => (a.id === b.id ? compareVersionDesc(a.version, b.version) : a.id < b.id ? -1 : 1))
  return rows
}

/** Test helper: reset cached default registry */
export function __resetDefaultRegistryForTests() {
  defaultRegistry = null
}
