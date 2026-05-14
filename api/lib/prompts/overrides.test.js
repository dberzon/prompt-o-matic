import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PromptOverrideIdMismatchError, listOverrides } from './overrides.js'
import { __resetDefaultRegistryForTests, getPrompt, loadRegistry } from './registry.js'

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

describe('project prompt overrides', () => {
  it('getPrompt with projectSlug returns override when file exists', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    writePrompt(
      lib,
      'base.polish.system.v1.prompt.md',
      '---\nid: polish.system\nversion: 1\ndescription: canonical\n---\n\nCANON_BODY',
    )
    writePrompt(
      lib,
      '_overrides/art-horror/polish.system.prompt.md',
      '---\nid: polish.system\nversion: 99\ndescription: art horror\n---\n\nOVERRIDE_BODY',
    )
    const reg = loadRegistry({ libraryDir: lib })
    const withSlug = getPrompt('polish.system', { projectSlug: 'art-horror', libraryDir: lib }, reg)
    expect(withSlug.body.trim()).toBe('OVERRIDE_BODY')
    expect(withSlug.version).toBe('99')
    const noSlug = getPrompt('polish.system', reg)
    expect(noSlug.body.trim()).toBe('CANON_BODY')
  })

  it('falls back to default when override absent', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    writePrompt(
      lib,
      'demo.z.v1.prompt.md',
      '---\nid: demo.z\nversion: 1\ndescription: z\n---\n\nZ_BODY',
    )
    const reg = loadRegistry({ libraryDir: lib })
    const rec = getPrompt('demo.z', { projectSlug: 'no-overrides-here', libraryDir: lib }, reg)
    expect(rec.body.trim()).toBe('Z_BODY')
  })

  it('rejects frontmatter id mismatch with clear error', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    writePrompt(lib, 't.v1.prompt.md', '---\nid: t\nversion: 1\ndescription: t\n---\n\nx')
    writePrompt(
      lib,
      '_overrides/bad/polish.system.prompt.md',
      '---\nid: wrong.id\nversion: 1\ndescription: bad\n---\n\nnope',
    )
    const reg = loadRegistry({ libraryDir: lib })
    expect(() => getPrompt('polish.system', { projectSlug: 'bad', libraryDir: lib }, reg)).toThrow(
      PromptOverrideIdMismatchError,
    )
    expect(() => getPrompt('polish.system', { projectSlug: 'bad', libraryDir: lib }, reg)).toThrow(
      /override path requires id "polish.system"/,
    )
  })

  it('versioned override wins over flat when version requested', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    writePrompt(lib, 'q.v1.prompt.md', '---\nid: q\nversion: 1\ndescription: q\n---\n\nQ1')
    writePrompt(
      lib,
      '_overrides/p2/q.v2.prompt.md',
      '---\nid: q\nversion: 2\ndescription: q2\n---\n\nQ2_O',
    )
    writePrompt(
      lib,
      '_overrides/p2/q.prompt.md',
      '---\nid: q\nversion: 9\ndescription: flat\n---\n\nQ_FLAT',
    )
    const reg = loadRegistry({ libraryDir: lib })
    expect(getPrompt('q', { projectSlug: 'p2', version: '2', libraryDir: lib }, reg).body.trim()).toBe('Q2_O')
    expect(getPrompt('q', { projectSlug: 'p2', libraryDir: lib }, reg).body.trim()).toBe('Q_FLAT')
  })

  it('listOverrides returns id, version, sourcePath', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    const mdA = '---\nid: aa.bb\nversion: 1\ndescription: a\n---\n\na'
    writePrompt(lib, '_overrides/proj1/aa.bb.prompt.md', mdA)
    const rows = listOverrides('proj1', { libraryDir: lib })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('aa.bb')
    expect(rows[0].version).toBe('1')
    expect(path.basename(rows[0].sourcePath)).toBe('aa.bb.prompt.md')
  })

  it('loadRegistry does not ingest _overrides files', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    writePrompt(
      lib,
      'sole.v1.prompt.md',
      '---\nid: sole\nversion: 1\ndescription: one\n---\n\nONE',
    )
    writePrompt(
      lib,
      '_overrides/x/other.prompt.md',
      '---\nid: ghost\nversion: 1\ndescription: g\n---\n\nGHOST',
    )
    const reg = loadRegistry({ libraryDir: lib })
    expect(reg.has('ghost')).toBe(false)
    expect(getPrompt('sole', reg).body.trim()).toBe('ONE')
  })

  it('getPrompt(id, { version }) matches string second-arg behavior', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'qpb-prompt-ovr-'))
    tempDirs.push(lib)
    writePrompt(lib, 'dual.v1.prompt.md', '---\nid: dual\nversion: 1\ndescription: a\n---\n\nA')
    writePrompt(lib, 'dual.v2.prompt.md', '---\nid: dual\nversion: 2\ndescription: b\n---\n\nB')
    const reg = loadRegistry({ libraryDir: lib })
    expect(getPrompt('dual', { version: '1' }, reg).body.trim()).toBe('A')
    expect(getPrompt('dual', '1', reg).body.trim()).toBe('A')
  })
})
