import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getPrompt, loadRegistry } from '../registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extrapolationPromptsDir = path.join(__dirname, '../../extrapolation/prompts')

/**
 * Extract the static prefix from a stage prompt builder's `return [` array: single-quoted
 * literals in order until the dynamic `` `Entity:`` / `` `Primary entity:`` line.
 * @param {string} absPath
 * @param {{ omitEmptyFragments?: boolean; primaryEntity?: boolean }} [opts]
 */
function staticPrefixFromStageBuilderSource(absPath, opts = {}) {
  const { omitEmptyFragments = true, primaryEntity = false } = opts
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
    if (primaryEntity ? line.includes('`Primary entity:') : line.includes('`Entity:')) break
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
    if (inner === '' && omitEmptyFragments) continue
    parts.push(inner)
  }
  return parts.join('\n')
}

describe('extrapolation batch-1 prompt registry vs inline builders (byte-equal)', () => {
  const reg = loadRegistry({ libraryDir: __dirname })

  it('extrapolation.s1.entityExtraction v1 body matches static strings in s1EntityExtraction.js', () => {
    const inline = staticPrefixFromStageBuilderSource(path.join(extrapolationPromptsDir, 's1EntityExtraction.js'), {
      omitEmptyFragments: false,
      primaryEntity: true,
    })
    expect(Buffer.from(getPrompt('extrapolation.s1.entityExtraction', '1', reg).body)).toEqual(Buffer.from(inline))
  })

  it('extrapolation.s2.historical v1 body matches static strings in s2HistoricalEnrichment.js', () => {
    const inline = staticPrefixFromStageBuilderSource(path.join(extrapolationPromptsDir, 's2HistoricalEnrichment.js'))
    expect(Buffer.from(getPrompt('extrapolation.s2.historical', '1', reg).body)).toEqual(Buffer.from(inline))
  })

  it('extrapolation.s3.psychology v1 body matches static strings in s3PsychologicalInference.js', () => {
    const inline = staticPrefixFromStageBuilderSource(path.join(extrapolationPromptsDir, 's3PsychologicalInference.js'))
    expect(Buffer.from(getPrompt('extrapolation.s3.psychology', '1', reg).body)).toEqual(Buffer.from(inline))
  })
})
