import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getPrompt, loadRegistry } from '../registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extrapolationPromptsDir = path.join(__dirname, '../../extrapolation/prompts')

/**
 * Pull the static prefix from a stage prompt builder: single-quoted literals in the
 * first `return [` array, in source order, until the `` `Entity:`` template line.
 * Skips empty string entries to mirror `.filter(Boolean)` in the builders.
 * @param {string} absPath
 */
function staticPrefixFromStageBuilderSource(absPath) {
  const src = fs.readFileSync(absPath, 'utf8')
  const lines = src.split(/\r?\n/)
  const start = lines.findIndex((l) => /\breturn\s*\[\s*$/.test(l.trimEnd()) || /\breturn\s*\[/.test(l))
  if (start === -1) {
    throw new Error(`No return [ in ${absPath}`)
  }
  const sq = /^\s*'((?:\\.|[^'\\])*)'\s*,?\s*$/
  /** @type {string[]} */
  const parts = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('`Entity:')) break
    const m = line.match(sq)
    if (!m) continue
    const raw = m[1]
    const inner = raw.replace(/\\(.)/g, (_, c) => {
      if (c === 'n') return '\n'
      if (c === 't') return '\t'
      if (c === '\\') return '\\'
      if (c === "'") return "'"
      return `\\${c}`
    })
    if (inner === '') continue
    parts.push(inner)
  }
  return parts.join('\n')
}

describe('extrapolation batch-2 prompt registry vs inline builders (byte-equal)', () => {
  const reg = loadRegistry({ libraryDir: __dirname })

  it('extrapolation.s4.environment v1 body matches static strings in s4EnvironmentalProjection.js', () => {
    const inline = staticPrefixFromStageBuilderSource(
      path.join(extrapolationPromptsDir, 's4EnvironmentalProjection.js'),
    )
    expect(Buffer.from(getPrompt('extrapolation.s4.environment', '1', reg).body)).toEqual(Buffer.from(inline))
  })

  it('extrapolation.s5.visualDescriptor v1 body matches static strings in s5VisualDescriptor.js', () => {
    const inline = staticPrefixFromStageBuilderSource(path.join(extrapolationPromptsDir, 's5VisualDescriptor.js'))
    expect(Buffer.from(getPrompt('extrapolation.s5.visualDescriptor', '1', reg).body)).toEqual(Buffer.from(inline))
  })

  it('extrapolation.s6.conflict v1 body matches static strings in s6ConflictDetection.js', () => {
    const inline = staticPrefixFromStageBuilderSource(path.join(extrapolationPromptsDir, 's6ConflictDetection.js'))
    expect(Buffer.from(getPrompt('extrapolation.s6.conflict', '1', reg).body)).toEqual(Buffer.from(inline))
  })
})
