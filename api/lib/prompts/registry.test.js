import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PromptNotFoundError,
  __resetDefaultRegistryForTests,
  getPrompt,
  listPrompts,
  loadRegistry,
} from './registry.js'

const tempDirs = []

afterEach(() => {
  __resetDefaultRegistryForTests()
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function writePrompt(dir, filename, contents) {
  const full = path.join(dir, filename)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, contents, 'utf8')
}

describe('loadRegistry / getPrompt / listPrompts', () => {
  it('loads multiple versions and returns highest by default', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-reg-'))
    tempDirs.push(dir)
    writePrompt(
      dir,
      'demo.a.v1.prompt.md',
      '---\nid: demo.a\nversion: 1\ndescription: first\n---\n\none',
    )
    writePrompt(
      dir,
      'nested/demo.a.v2.prompt.md',
      '---\nid: demo.a\nversion: 2\ndescription: second\n---\n\ntwo',
    )
    const reg = loadRegistry({ libraryDir: dir })
    expect(getPrompt('demo.a', reg).body.trim()).toBe('two')
    expect(getPrompt('demo.a', '1', reg).body.trim()).toBe('one')
  })

  it('throws PromptNotFoundError for unknown id', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-reg-'))
    tempDirs.push(dir)
    const reg = loadRegistry({ libraryDir: dir })
    expect(() => getPrompt('missing', reg)).toThrow(PromptNotFoundError)
  })

  it('throws when frontmatter is missing required fields', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-reg-'))
    tempDirs.push(dir)
    writePrompt(dir, 'bad.prompt.md', '---\nid: only\n---\n\nnope')
    expect(() => loadRegistry({ libraryDir: dir })).toThrow(/bad\.prompt\.md/)
  })

  it('lists prompts with metadata', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-reg-'))
    tempDirs.push(dir)
    writePrompt(
      dir,
      'z.v1.prompt.md',
      '---\nid: z.z\nversion: 1\ndescription: Zed\ntags: a, b\n---\n\nb',
    )
    const reg = loadRegistry({ libraryDir: dir })
    const rows = listPrompts(reg)
    expect(rows.some((r) => r.id === 'z.z' && r.version === '1')).toBe(true)
  })
})
