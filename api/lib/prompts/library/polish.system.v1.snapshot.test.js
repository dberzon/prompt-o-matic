import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getPrompt, loadRegistry } from '../registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const polishCorePath = path.join(__dirname, '../../polishCore.js')

/**
 * Reads the template literal assigned to SYSTEM_PROMPT in polishCore.js without importing it.
 * @param {string} absPath
 */
function systemPromptFromPolishCoreSource(absPath) {
  const src = fs.readFileSync(absPath, 'utf8')
  const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`\r?\n\r?\nfunction normalizeFrontPrefix/)
  if (!m) {
    throw new Error(`Could not extract SYSTEM_PROMPT template from ${absPath}`)
  }
  return m[1]
}

describe('polish.system v1 registry vs polishCore inline (byte-equal)', () => {
  it('registry body matches SYSTEM_PROMPT bytes in api/lib/polishCore.js', () => {
    const reg = loadRegistry({ libraryDir: __dirname })
    const inline = systemPromptFromPolishCoreSource(polishCorePath)
    expect(Buffer.from(getPrompt('polish.system', '1', reg).body)).toEqual(Buffer.from(inline))
  })
})
