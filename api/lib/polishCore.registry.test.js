import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const polishCorePath = path.join(__dirname, 'polishCore.js')
const polishSystemMessagePath = path.join(__dirname, 'polish', 'polishSystemMessage.js')

describe('polishCore registry wiring', () => {
  it('does not embed the legacy inline polish system template literal', () => {
    const src = fs.readFileSync(polishCorePath, 'utf8')
    expect(src).not.toMatch(/const SYSTEM_PROMPT = `/)
    expect(src).not.toContain('STYLE TRANSLATION FRAMEWORK (APPLY UNIVERSALLY):')
  })

  it('loads system instructions via getPrompt and renderPrompt', () => {
    const src = fs.readFileSync(polishSystemMessagePath, 'utf8')
    expect(src).toContain("getPrompt('polish.system')")
    expect(src).toContain('renderPrompt(rec.body')
  })
})
