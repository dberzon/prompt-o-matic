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

describe('extrapolation batch-1 prompt library (registry parity)', () => {
  const reg = loadRegistry({ libraryDir: __dirname })

  it.each([
    ['extrapolation.s1.entityExtraction', '1', 'extrapolation.s1.entityExtraction.v1.prompt.md'],
    ['extrapolation.s2.historical', '1', 'extrapolation.s2.historical.v1.prompt.md'],
    ['extrapolation.s3.psychology', '1', 'extrapolation.s3.psychology.v1.prompt.md'],
  ])('%s@%s body matches on-disk .prompt.md', (id, version, fileName) => {
    const disk = readPromptBodyFromDisk(fileName)
    const fromReg = getPrompt(id, version, reg).body
    expect(Buffer.from(fromReg)).toEqual(Buffer.from(disk))
    expect(fromReg.trimEnd()).toMatch(/\{\{dynamicContext\}\}$/)
  })
})
