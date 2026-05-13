import { describe, expect, it } from 'vitest'
import { PromptFrontmatterSchema, parsePromptFrontmatter, parseSimpleYaml, splitPromptFile } from './frontmatter.js'

describe('PromptFrontmatterSchema', () => {
  it('accepts known fields and rejects unknown top-level keys', () => {
    const ok = PromptFrontmatterSchema.safeParse({
      id: 'a.b',
      version: '1',
      description: 'd',
      tags: 'x, y',
    })
    expect(ok.success).toBe(true)

    const bad = PromptFrontmatterSchema.safeParse({
      id: 'a.b',
      version: '1',
      description: 'd',
      mystery: 'nope',
    })
    expect(bad.success).toBe(false)
  })
})

describe('parseSimpleYaml', () => {
  it('parses key value lines', () => {
    expect(parseSimpleYaml('a: 1\nb: two')).toEqual({ a: '1', b: 'two' })
  })
})

describe('splitPromptFile', () => {
  it('splits frontmatter and body', () => {
    const src = '---\nid: x\nversion: 1\ndescription: d\n---\n\nhello'
    const { frontmatterText, body } = splitPromptFile(src, 'f.md')
    expect(frontmatterText).toContain('id: x')
    expect(body.trim()).toBe('hello')
  })
})

describe('parsePromptFrontmatter', () => {
  it('throws with file path when required fields missing', () => {
    const bad = '---\nid: only\n---\n\nx'
    expect(() => parsePromptFrontmatter(bad, '/tmp/bad.md')).toThrow(/\/tmp\/bad\.md/)
  })
})
