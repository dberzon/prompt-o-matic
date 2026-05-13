import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * @typedef {import('./tool.js').ToolDescriptor} ToolDescriptor
 */

const TOOL_SUFFIX = '.tool.js'
const DEFAULT_TOOLS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)))

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listToolFilesRecursive(dir) {
  /** @type {string[]} */
  const out = []
  if (!fs.existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name)
      if (ent.isDirectory()) {
        stack.push(full)
      } else if (ent.isFile() && ent.name.endsWith(TOOL_SUFFIX)) {
        out.push(full)
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * Basename without `.tool.js` (e.g. `echo.tool.js` → `echo`).
 * @param {string} filePath
 */
function stemFromToolPath(filePath) {
  const base = path.basename(filePath)
  if (!base.endsWith(TOOL_SUFFIX)) return ''
  return base.slice(0, -TOOL_SUFFIX.length)
}

/**
 * @param {{ cwd?: string; dir?: string }} [opts]
 * @returns {Promise<ToolDescriptor[]>}
 */
export async function discoverTools({ cwd = process.cwd(), dir = DEFAULT_TOOLS_DIR } = {}) {
  const root = path.isAbsolute(dir) ? dir : path.resolve(cwd, dir)
  const files = listToolFilesRecursive(root)
  /** @type {ToolDescriptor[]} */
  const tools = []
  /** @type {Map<string, string>} */
  const nameToFile = new Map()

  for (const absPath of files) {
    const stem = stemFromToolPath(absPath)
    const href = pathToFileURL(absPath).href
    const mod = await import(href)
    const desc = mod.default
    if (!desc || typeof desc !== 'object') {
      throw new Error(`Tool module must default-export a descriptor: ${absPath}`)
    }
    if (typeof desc.name !== 'string' || typeof desc.handler !== 'function') {
      throw new Error(`Tool descriptor missing name or handler: ${absPath}`)
    }
    if (desc.name !== stem) {
      throw new Error(
        `Tool name "${desc.name}" does not match file stem "${stem}" (${path.relative(root, absPath) || absPath})`,
      )
    }
    if (nameToFile.has(desc.name)) {
      const other = nameToFile.get(desc.name)
      throw new Error(`Duplicate tool name "${desc.name}" (${absPath} and ${other})`)
    }
    nameToFile.set(desc.name, absPath)
    tools.push(desc)
  }

  return tools
}
