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

describe('polish.system v1 registry parity', () => {
  it('registry body matches on-disk polish.system.v1.prompt.md', () => {
    const reg = loadRegistry({ libraryDir: __dirname })
    const disk = readPromptBodyFromDisk('polish.system.v1.prompt.md')
    const fromReg = getPrompt('polish.system', '1', reg).body
    expect(Buffer.from(fromReg)).toEqual(Buffer.from(disk))
  })
})
