/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  CURRENT_SHARE_VERSION,
  decodeSharePayload,
  decodeShareState,
  encodeShareState,
  resolveShareBootstrap,
  workflowLocalStorageToCanonical,
} from './ShareLinkContext.jsx'

const V1_FIXTURE = {
  scene: 'v1 scene',
  dirKey: 'nolan',
  charCount: 2,
  chars: [{ g: 'man', a: '40s' }, { g: 'woman', a: '30s' }],
  scenario: 'noir',
  chips: { lighting: ['neon'] },
  blendEnabled: true,
  blendDir: 'wes',
  blendWeight: 65,
  narrativeBeat: 'beat-a',
}

const V2_FIXTURE = {
  v: 2,
  scene: 'v2 scene',
  dirKey: 'lynch',
  charCount: 1,
  chars: [{ g: 'woman', a: '20s' }],
  scenario: null,
  chips: {},
  blendEnabled: false,
  blendDir: null,
  blendWeight: 70,
  narrativeBeat: null,
  projectId: 'proj_v2',
}

const V3_FIXTURE = {
  v: 3,
  step: 4,
  projectId: 'proj_v3',
  charId: 'char_abc',
  entityId: 'ent_xyz',
  bankSlug: 'slug-ivan',
  scene: 'v3 scene',
  dirKey: 'kubrick',
  charCount: 3,
  chars: [
    { g: 'man', a: '50s' },
    { g: 'woman', a: '40s' },
    { g: 'man', a: '20s' },
  ],
  scenario: 'thriller',
  chips: { mood: ['tense'] },
  blend: { enabled: true, dirKey: 'fincher', weight: 80 },
  narrativeBeat: 'beat-b',
}

afterEach(() => {
  localStorage.clear()
})

describe('ShareLinkContext v1/v2/v3 decode', () => {
  it('decodes v1 fixture with workflow defaults and workspace fields', () => {
    const decoded = decodeSharePayload(V1_FIXTURE)
    expect(decoded).toBeTruthy()
    expect(decoded.v).toBe(3)
    expect(decoded.scene).toBe('v1 scene')
    expect(decoded.step).toBe(1)
    expect(decoded.projectId).toBeNull()
    expect(decoded.charId).toBeNull()
    expect(decoded.entityId).toBeNull()
    expect(decoded.bankSlug).toBeNull()
    expect(decoded.blend).toEqual({ enabled: true, dirKey: 'wes', weight: 65 })
  })

  it('decodes v2 fixture with v2 fields and new workflow defaults', () => {
    const decoded = decodeSharePayload(V2_FIXTURE)
    expect(decoded.v).toBe(3)
    expect(decoded.scene).toBe('v2 scene')
    expect(decoded.projectId).toBe('proj_v2')
    expect(decoded.step).toBe(1)
    expect(decoded.charId).toBeNull()
    expect(decoded.entityId).toBeNull()
    expect(decoded.bankSlug).toBeNull()
    expect(decoded.blend.enabled).toBe(false)
  })

  it('v3 fixture round-trips through encode and decode', () => {
    const encoded = encodeShareState(V3_FIXTURE)
    const decoded = decodeShareState(encoded)
    expect(decoded).toBeTruthy()
    expect(decoded.v).toBe(3)
    expect(decoded.step).toBe(4)
    expect(decoded.projectId).toBe('proj_v3')
    expect(decoded.charId).toBe('char_abc')
    expect(decoded.entityId).toBe('ent_xyz')
    expect(decoded.bankSlug).toBe('slug-ivan')
    expect(decoded.scene).toBe('v3 scene')
    expect(decoded.dirKey).toBe('kubrick')
    expect(decoded.charCount).toBe(3)
    expect(decoded.chars).toHaveLength(3)
    expect(decoded.blend).toEqual({ enabled: true, dirKey: 'fincher', weight: 80 })
    expect(decoded.narrativeBeat).toBe('beat-b')
  })

  it('encode always produces v3', () => {
    const encoded = encodeShareState(V1_FIXTURE)
    const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded))))
    expect(parsed.v).toBe(CURRENT_SHARE_VERSION)
    expect(CURRENT_SHARE_VERSION).toBe(3)
    expect(parsed.blend).toEqual({ enabled: true, dirKey: 'wes', weight: 65 })
    expect(parsed.step).toBe(1)
  })
})

describe('ShareLinkContext hash precedence', () => {
  it('prefers hash-decoded state over localStorage workflow snapshot', () => {
    localStorage.setItem(
      'qpb.workflow.v1',
      JSON.stringify({
        scene: 'from local storage',
        dirKey: 'nolan',
        charCount: 1,
        chars: [{ g: 'man', a: '30s' }],
        activeProjectId: 'proj_ls',
        activeCharId: 'char_ls',
      }),
    )

    const hashPayload = {
      ...V3_FIXTURE,
      scene: 'from url hash',
      projectId: 'proj_hash',
      charId: 'char_hash',
    }
    const hashDecoded = decodeShareState(encodeShareState(hashPayload))
    const localDecoded = workflowLocalStorageToCanonical(
      JSON.parse(localStorage.getItem('qpb.workflow.v1')),
    )

    const resolved = resolveShareBootstrap(hashDecoded, localDecoded)
    expect(resolved.scene).toBe('from url hash')
    expect(resolved.projectId).toBe('proj_hash')
    expect(resolved.charId).toBe('char_hash')
    expect(resolved.step).toBe(4)
  })

  it('falls back to localStorage when hash is absent', () => {
    localStorage.setItem(
      'qpb.workflow.v1',
      JSON.stringify({
        scene: 'stored only',
        dirKey: null,
        charCount: 2,
        chars: [{ g: 'woman', a: '20s' }, { g: 'man', a: '40s' }],
        activeCharId: 'char_only_ls',
      }),
    )
    const localDecoded = workflowLocalStorageToCanonical(
      JSON.parse(localStorage.getItem('qpb.workflow.v1')),
    )
    const resolved = resolveShareBootstrap(null, localDecoded)
    expect(resolved.scene).toBe('stored only')
    expect(resolved.charId).toBe('char_only_ls')
    expect(resolved.step).toBe(1)
  })
})
