/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { ProjectProvider } from './ProjectContext.jsx'
import {
  WORKFLOW_PERSIST_DEBOUNCE_MS,
  WORKFLOW_PERSIST_KEY,
  WorkspaceProvider,
  useWorkspace,
} from './WorkspaceContext.jsx'
import {
  CURRENT_SHARE_VERSION,
  ShareLinkProvider,
  clearShareStateHash,
  decodeSharePayload,
  decodeShareState,
  encodeShareState,
  persistCanonicalShareToLocalStorage,
  resolveShareBootstrap,
  workflowLocalStorageToCanonical,
} from './ShareLinkContext.jsx'

vi.mock('../api/promptStorage.js', () => ({
  fetchWorkspaceProfiles: vi.fn().mockResolvedValue([]),
  upsertWorkspaceProfileRemote: vi.fn().mockResolvedValue(null),
  deleteWorkspaceProfileRemote: vi.fn().mockResolvedValue(null),
}))

vi.mock('../lib/api/projects.js', () => ({
  listProjects: vi.fn().mockResolvedValue({ ok: true, items: [] }),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  setActiveProject: vi.fn(),
}))

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
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.useRealTimers()
})

function SceneProbe({ nextScene, onReady }) {
  const ws = useWorkspace()
  useEffect(() => {
    if (nextScene != null) ws.setScene(nextScene)
    onReady?.(ws)
  }, [nextScene, onReady, ws])
  return <div data-testid="scene">{ws.scene}</div>
}

function renderShareBootstrap(ui) {
  return render(
    <ProjectProvider>
      <WorkspaceProvider>
        <ShareLinkProvider>{ui}</ShareLinkProvider>
      </WorkspaceProvider>
    </ProjectProvider>,
  )
}

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

describe('ShareLinkContext consume share hash after bootstrap', () => {
  it('clearShareStateHash removes only #state= fragments', () => {
    window.history.replaceState({}, '', '/studio?x=1#state=abc')
    expect(clearShareStateHash()).toBe(true)
    expect(window.location.pathname).toBe('/studio')
    expect(window.location.search).toBe('?x=1')
    expect(window.location.hash).toBe('')

    window.history.replaceState({}, '', '/studio#other')
    expect(clearShareStateHash()).toBe(false)
    expect(window.location.hash).toBe('#other')
  })

  it('persistCanonicalShareToLocalStorage seeds qpb.workflow.v1 from share payload', () => {
    persistCanonicalShareToLocalStorage({
      ...decodeSharePayload(V3_FIXTURE),
      scene: 'seeded from share',
    })
    const stored = JSON.parse(localStorage.getItem(WORKFLOW_PERSIST_KEY))
    expect(stored.scene).toBe('seeded from share')
    expect(stored.activeProjectId).toBe('proj_v3')
    expect(stored.activeCharId).toBe('char_abc')
    expect(stored.dirKey).toBe('kubrick')
  })

  it('consumes #state= after apply so later edits survive reload', () => {
    vi.useFakeTimers()
    localStorage.setItem(
      WORKFLOW_PERSIST_KEY,
      JSON.stringify({
        scene: 'older local edits',
        dirKey: null,
        charCount: 1,
        chars: [{ g: 'man', a: '30s' }],
        scenario: null,
        chips: {},
        blend: { enabled: false, dirKey: null, weight: 70 },
        narrativeBeat: null,
      }),
    )
    const encoded = encodeShareState({
      ...V3_FIXTURE,
      scene: 'shared original scene',
    })
    window.history.replaceState({}, '', `/#state=${encoded}`)

    const first = renderShareBootstrap(<SceneProbe />)
    expect(screen.getByTestId('scene').textContent).toBe('shared original scene')
    expect(window.location.hash).toBe('')
    expect(JSON.parse(localStorage.getItem(WORKFLOW_PERSIST_KEY)).scene).toBe(
      'shared original scene',
    )

    first.unmount()
    cleanup()

    const second = renderShareBootstrap(<SceneProbe nextScene="edited after share" />)
    act(() => {
      vi.advanceTimersByTime(WORKFLOW_PERSIST_DEBOUNCE_MS)
    })
    expect(JSON.parse(localStorage.getItem(WORKFLOW_PERSIST_KEY)).scene).toBe(
      'edited after share',
    )
    second.unmount()
    cleanup()

    // Reload without a share hash — persisted edits must win.
    renderShareBootstrap(<SceneProbe />)
    expect(window.location.hash).toBe('')
    expect(screen.getByTestId('scene').textContent).toBe('edited after share')
  })

  it('clears a corrupt #state= hash without wiping localStorage', () => {
    localStorage.setItem(
      WORKFLOW_PERSIST_KEY,
      JSON.stringify({
        scene: 'keep local',
        dirKey: null,
        charCount: 1,
        chars: [{ g: 'woman', a: '20s' }],
        scenario: null,
        chips: {},
        blend: { enabled: false, dirKey: null, weight: 70 },
        narrativeBeat: null,
      }),
    )
    window.history.replaceState({}, '', '/#state=%%%not-valid%%%')

    renderShareBootstrap(<SceneProbe />)
    expect(window.location.hash).toBe('')
    expect(screen.getByTestId('scene').textContent).toBe('keep local')
    expect(JSON.parse(localStorage.getItem(WORKFLOW_PERSIST_KEY)).scene).toBe('keep local')
  })
})
