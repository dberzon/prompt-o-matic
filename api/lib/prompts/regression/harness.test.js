/**
 * Prompt regression harness — golden template renders for migrated prompts.
 *
 * To update goldens after an intentional prompt edit:
 *   UPDATE_GOLDENS=1 npm test -- regression
 * (Windows PowerShell: $env:UPDATE_GOLDENS='1'; npm test -- regression)
 * Then review `git diff api/lib/prompts/regression/goldens/` and confirm changes
 * are intentional before committing.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderPromptFixture } from './harness.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURE_NAMES = [
  'polish.system.v1',
  'extrapolation.s1.entityExtraction.v1',
  'extrapolation.s2.historical.v1',
  'extrapolation.s3.psychology.v1',
  'extrapolation.s4.environment.v1',
  'extrapolation.s5.visualDescriptor.v1',
  'extrapolation.s6.conflict.v1',
  'characterOptimize.v1',
]

describe('prompt regression harness', () => {
  it.each(FIXTURE_NAMES)('prompt %s matches golden', async (name) => {
    const spec = (await import(`./inputs/${name}.input.js`)).default
    const rendered = renderPromptFixture(spec)
    const goldenPath = path.join(__dirname, 'goldens', `${name}.txt`)

    if (process.env.UPDATE_GOLDENS === '1') {
      await fs.mkdir(path.dirname(goldenPath), { recursive: true })
      await fs.writeFile(goldenPath, rendered, 'utf8')
      return
    }

    const golden = await fs.readFile(goldenPath, 'utf8')
    expect(rendered).toBe(golden)
  })
})
