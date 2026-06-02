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
import { ShareLinkProvider } from './context/ShareLinkContext.jsx'
import { EmbeddedHealthProvider } from './context/EmbeddedHealthContext.jsx'
import App from './App.jsx'

vi.mock('./components/CastingStepContainer.jsx', () => ({
  default: ({ activeCharId, activeEntityId, setActiveCharId, setActiveEntityId, setActiveBankSlug, setActiveStep }) => (
    <section aria-label="mock casting step">
      <p>Mock casting char: {activeCharId ?? 'none'}</p>
      <p>Mock casting entity: {activeEntityId ?? 'none'}</p>
      <button
        type="button"
        onClick={() => {
          setActiveCharId('char_project_a')
          setActiveEntityId('entity_project_a')
          setActiveBankSlug('char_project_a_slug')
        }}
      >
        Select stale workflow target
      </button>
      <button type="button" onClick={() => setActiveStep(2)}>
        Open Bible
      </button>
    </section>
  ),
}))

vi.mock('./components/BibleStepContainer.jsx', () => ({
  default: ({ activeCharId, activeEntityId }) => (
    <section aria-label="mock bible step">
      <p>Bible char: {activeCharId ?? 'none'}</p>
      <p>Bible entity: {activeEntityId ?? 'none'}</p>
    </section>
  ),
}))

function makeProject(overrides) {
  return {
    id: 'proj_default',
    slug: 'default',
    name: 'Default Project',
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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('App workflow selection reset', () => {
  it('clears selected character, entity, and bank slug when switching projects', async () => {
    setupAppMocks()
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Default Project' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /select stale workflow target/i }))
    fireEvent.click(screen.getByRole('button', { name: /open bible/i }))
    expect(await screen.findByText('Bible entity: entity_project_a')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Default Project' }))
    fireEvent.click(screen.getByRole('option', { name: 'Second Project' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Second Project' })).toBeTruthy()
    })
    expect(screen.getByText('Mock casting char: none')).toBeTruthy()
    expect(screen.getByText('Mock casting entity: none')).toBeTruthy()

    const stepper = screen.getByRole('navigation', { name: /workflow stepper/i })
    fireEvent.click(within(stepper).getByRole('button', { name: /bible/i }))
    expect(screen.getByText('Bible char: none')).toBeTruthy()
    expect(screen.getByText('Bible entity: none')).toBeTruthy()
  })
})
