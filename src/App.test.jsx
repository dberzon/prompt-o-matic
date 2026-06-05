/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as projectsApi from './lib/api/projects.js'
import * as promptStorage from './api/promptStorage.js'
import * as comfyApi from './lib/api/comfy.js'
import { ProjectProvider } from './context/ProjectContext.jsx'
import { WorkspaceProvider } from './context/WorkspaceContext.jsx'
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

  it('restores active project and character from workflow localStorage', async () => {
    setupAppMocks()
    localStorage.setItem('qpb.workflow.v1', JSON.stringify({
      scene: 'stored scene',
      dirKey: null,
      charCount: 1,
      chars: [{ g: 'man', a: '40s' }],
      scenario: null,
      chips: {},
      activeProjectId: 'p_two',
      activeCharId: 'char_restore_123',
    }))

    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Second Project' })).toBeTruthy()
    })
    expect(screen.getByText(/Selected character: char_res/i)).toBeTruthy()
  })

  it('applies v3 share workflow fields to App navigation state on bootstrap', async () => {
    setupAppMocks()
    const encoded = encodeShareState({
      v: 3,
      step: 4,
      projectId: 'p_two',
      charId: 'char_hash',
      entityId: 'ent_hash',
      bankSlug: 'bank_hash',
      scene: 'hash scene',
      dirKey: null,
      charCount: 1,
      chars: [{ g: 'woman', a: '30s' }],
      scenario: null,
      chips: {},
      blend: { enabled: false, dirKey: null, weight: 70 },
      narrativeBeat: null,
    })
    window.location.hash = `state=${encoded}`

    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Second Project' })).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Prompt Studio/i }).getAttribute('aria-current')).toBe('step')
    })
  })
})
