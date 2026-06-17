/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as projectsApi from './lib/api/projects.js'
import * as promptStorage from './api/promptStorage.js'
import * as comfyApi from './lib/api/comfy.js'
import { ProjectProvider } from './context/ProjectContext.jsx'
import { WorkspaceProvider, WORKFLOW_PERSIST_KEY } from './context/WorkspaceContext.jsx'
import { ShareLinkProvider, encodeShareState } from './context/ShareLinkContext.jsx'
import { EmbeddedHealthProvider } from './context/EmbeddedHealthContext.jsx'
import App from './App.jsx'

const STEP_LABELS = ['Casting', 'Bible', 'Extrapolation', 'Prompt Studio', 'Render', 'Portfolio']

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.location.hash = ''
})

/** @returns {import('./lib/api/projects.js').ProjectRecord} */
function makeProject(overrides) {
  return {
    id: 'p_x',
    slug: 'slug-x',
    name: 'Name X',
    eraEntityId: null,
    active: true,
    payload: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function setupAppMocks() {
  vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
    ok: true,
    items: [
      makeProject({ id: 'proj_default', slug: 'default', name: 'Default Project' }),
      makeProject({ id: 'p_two', slug: 'two', name: 'Second Project' }),
    ],
  })
  vi.spyOn(promptStorage, 'fetchWorkspaceProfiles').mockResolvedValue([])
  vi.spyOn(comfyApi, 'getComfyStatus').mockResolvedValue({
    comfy: { available: false, baseUrl: null },
  })
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [] }),
  })
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
}

function renderApp() {
  return render(
    <ProjectProvider>
      <WorkspaceProvider>
        <ShareLinkProvider>
          <EmbeddedHealthProvider>
            <App />
          </EmbeddedHealthProvider>
        </ShareLinkProvider>
      </WorkspaceProvider>
    </ProjectProvider>,
  )
}

describe('App', () => {
  it('mounts inside Project, Workspace, ShareLink, and EmbeddedHealth providers without throwing', async () => {
    setupAppMocks()
    expect(() => renderApp()).not.toThrow()

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /workflow stepper/i })).toBeTruthy()
    })
  })

  it('renders AppHeader with project selector on every workflow step', async () => {
    setupAppMocks()
    renderApp()

    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeTruthy()
    })

    const stepper = screen.getByRole('navigation', { name: /workflow stepper/i })
    for (const label of STEP_LABELS) {
      fireEvent.click(within(stepper).getByRole('button', { name: new RegExp(label, 'i') }))
      expect(screen.getByTestId('app-header')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Default Project' })).toBeTruthy()
    }
  })

  it('blocks step content with overlay when active project is not yet selected', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockImplementation(() => new Promise(() => {}))
    vi.spyOn(promptStorage, 'fetchWorkspaceProfiles').mockResolvedValue([])
    vi.spyOn(comfyApi, 'getComfyStatus').mockResolvedValue({
      comfy: { available: false, baseUrl: null },
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    })

    renderApp()

    expect(screen.getByTestId('app-header')).toBeTruthy()
    expect(screen.getByText(/select or create a project to continue/i)).toBeTruthy()
    expect(screen.queryByTestId('step-content')).toBeNull()
    expect(screen.queryByRole('navigation', { name: /workflow stepper/i })).toBeNull()
    expect(screen.getByRole('button', { name: /loading projects/i })).toBeTruthy()
  })

  it('on /dev-dashboard renders DevDashboard without header or workflow stepper', () => {
    const originalPathname = window.location.pathname
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/dev-dashboard' },
    })

    setupAppMocks()
    renderApp()

    expect(screen.getByTestId('dev-dashboard')).toBeTruthy()
    expect(screen.queryByTestId('app-header')).toBeNull()
    expect(screen.queryByRole('navigation', { name: /workflow|stepper/i })).toBeNull()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: originalPathname },
    })
  })

  it('swaps step content when activeStep changes (step 1 container vs step 6 placeholder)', async () => {
    setupAppMocks()
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Casting Pipeline/i })).toBeTruthy()
    })

    const stepper = screen.getByRole('navigation', { name: /workflow stepper/i })
    fireEvent.click(within(stepper).getByRole('button', { name: /portfolio/i }))
    const panel = await screen.findByTestId('step-panel')
    expect(panel.textContent).toBe('Portfolio')

    fireEvent.click(within(stepper).getByRole('button', { name: /casting/i }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Casting Pipeline/i })).toBeTruthy()
    })
  })

  it('restores the active workflow character from persisted workspace state', async () => {
    setupAppMocks()
    localStorage.setItem(WORKFLOW_PERSIST_KEY, JSON.stringify({
      scene: '',
      dirKey: null,
      charCount: 1,
      chars: [{ g: 'person', a: '30s' }],
      chips: {},
      activeProjectId: 'proj_default',
      activeCharId: 'char_restore_123',
    }))

    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next step/i }).disabled).toBe(false)
    })
    expect(screen.getByText(/selected character: char_res/i)).toBeTruthy()
  })

  it('applies workflow fields from share state on boot', async () => {
    const originalHash = window.location.hash
    setupAppMocks()
    window.location.hash = `#state=${encodeShareState({
      v: 3,
      step: 4,
      projectId: 'proj_default',
      charId: 'char_from_share',
      entityId: 'entity_from_share',
      bankSlug: 'bank_from_share',
      scene: 'shared scene',
      dirKey: null,
      charCount: 1,
      chars: [{ g: 'person', a: '30s' }],
      chips: {},
    })}`

    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /prompt studio/i }).getAttribute('aria-current')).toBe('step')
    })

    window.location.hash = originalHash
  })
})
