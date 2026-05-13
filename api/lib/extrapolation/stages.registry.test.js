import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const stagesPath = path.join(__dirname, 'stages.js')

describe('extrapolation stages registry wiring', () => {
  it('does not import legacy inline prompt modules', () => {
    const src = fs.readFileSync(stagesPath, 'utf8')
    expect(src).not.toMatch(/['"]\.\/prompts\//)
    expect(src).not.toMatch(/['"]\.\.\/extrapolation\/prompts\//)
  })
})
