/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as projectsApi from '../lib/api/projects.js'
import * as promptStorage from '../api/promptStorage.js'
import * as comfyApi from '../lib/api/comfy.js'
import { ProjectProvider } from '../context/ProjectContext.jsx'
import { WorkspaceProvider } from '../context/WorkspaceContext.jsx'
import { ShareLinkProvider } from '../context/ShareLinkContext.jsx'
import { EmbeddedHealthProvider } from '../context/EmbeddedHealthContext.jsx'
import PromptStudioStep from './PromptStudioStep.jsx'

vi.mock('./SceneScaffold.jsx', () => ({ default: () => null }))
vi.mock('./SceneDeck.jsx', () => ({ default: () => null }))
vi.mock('./SceneMatcher.jsx', () => ({ default: () => null }))
vi.mock('./MobilePromptBar.jsx', () => ({ default: () => null }))

vi.mock('./SceneInput.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea
      aria-label="Scene description"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

function renderStep(props) {
  vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
    ok: true,
    items: [{
      id: 'proj_default',
      slug: 'default',
      name: 'Default',
      eraEntityId: null,
      active: true,
      payload: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
  })
  vi.spyOn(comfyApi, 'getComfyStatus').mockResolvedValue({
    comfy: { available: false, baseUrl: null },
  })
  vi.spyOn(promptStorage, 'fetchWorkspaceProfiles').mockResolvedValue([])

  return render(
    <ProjectProvider>
      <WorkspaceProvider>
        <ShareLinkProvider>
          <EmbeddedHealthProvider>
            <PromptStudioStep {...props} />
          </EmbeddedHealthProvider>
        </ShareLinkProvider>
      </WorkspaceProvider>
    </ProjectProvider>,
  )
}

const baseProps = {
  activeProjectId: 'proj_default',
  activeEntityId: null,
  onNext: vi.fn(),
  onPrev: vi.fn(),
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: {
      get: (key) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

/** @param {ReturnType<typeof vi.fn>} fetchMock */
function findPolishPost(fetchMock) {
  return fetchMock.mock.calls.find(([url, init]) => (
    String(url) === '/api/polish' && init?.method === 'POST'
  ))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('PromptStudioStep', () => {
  it('renders scene textarea, director selector, and chips section', () => {
    renderStep(baseProps)
    expect(screen.getByRole('textbox', { name: /scene/i })).toBeTruthy()
    expect(screen.getByText(/director register/i)).toBeTruthy()
    expect(screen.getByText(/technical presets/i)).toBeTruthy()
  })

  it('POST /api/polish includes entityId when activeEntityId is set', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (String(url) === '/api/polish' && init?.method === 'POST') {
        return jsonResponse({
          polished: 'polished output',
          provider: 'ollama',
          engine: 'local',
          fallback: null,
        })
      }
      return jsonResponse({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderStep({
      ...baseProps,
      activeEntityId: 'ruslan_levashov',
    })

    fireEvent.click(screen.getByRole('button', { name: /golden hour/i }))
    fireEvent.click(screen.getByRole('button', { name: /polish with ai/i }))

    await waitFor(() => {
      expect(findPolishPost(fetchMock)).toBeTruthy()
    })

    const [, init] = findPolishPost(fetchMock)
    const body = JSON.parse(String(init?.body || '{}'))
    expect(body.entityId).toBe('ruslan_levashov')
    expect(body.fragments?.length).toBeGreaterThan(0)
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/polish')).toHaveLength(1)
  })

  it('POST /api/polish omits entityId field when activeEntityId is null', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (String(url) === '/api/polish' && init?.method === 'POST') {
        return jsonResponse({
          polished: 'polished output',
          provider: 'ollama',
          engine: 'local',
          fallback: null,
        })
      }
      return jsonResponse({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderStep(baseProps)

    fireEvent.click(screen.getByRole('button', { name: /golden hour/i }))
    fireEvent.click(screen.getByRole('button', { name: /polish with ai/i }))

    await waitFor(() => {
      expect(findPolishPost(fetchMock)).toBeTruthy()
    })

    const [, init] = findPolishPost(fetchMock)
    const body = JSON.parse(String(init?.body || '{}'))
    expect(body).not.toHaveProperty('entityId')
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/polish')).toHaveLength(1)
  })
})
