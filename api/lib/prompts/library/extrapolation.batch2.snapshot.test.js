import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parsePromptFrontmatter } from '../frontmatter.js'
import { getPrompt, loadRegistry } from '../registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readPromptBodyFromDisk(fileName) {
  const abs = path.join(__dirname, fileName)
  const contents = fs.readFileSync(abs, 'utf8')
  const { body } = parsePromptFrontmatter(contents, abs)
  return body
}

describe('extrapolation batch-2 prompt library (registry parity)', () => {
  const reg = loadRegistry({ libraryDir: __dirname })

  it.each([
    ['extrapolation.s4.environment', '1', 'extrapolation.s4.environment.v1.prompt.md'],
    ['extrapolation.s5.visualDescriptor', '1', 'extrapolation.s5.visualDescriptor.v1.prompt.md'],
    ['extrapolation.s6.conflict', '1', 'extrapolation.s6.conflict.v1.prompt.md'],
  ])('%s@%s body matches on-disk .prompt.md', (id, version, fileName) => {
    const disk = readPromptBodyFromDisk(fileName)
    const fromReg = getPrompt(id, version, reg).body
    expect(Buffer.from(fromReg)).toEqual(Buffer.from(disk))
    expect(fromReg.trimEnd()).toMatch(/\{\{dynamicContext\}\}$/)
  })
})
