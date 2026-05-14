/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as projectsApi from '../lib/api/projects.js'
import { ACTIVE_PROJECT_STORAGE_KEY, ProjectProvider, useProject } from './ProjectContext.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

/** @returns {import('../lib/api/projects.js').ProjectRecord} */
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

describe('ProjectContext', () => {
  it('on mount fetches projects and selects proj_default when localStorage is empty', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [
        makeProject({ id: 'p_other', slug: 'other', name: 'Other' }),
        makeProject({ id: 'proj_default', slug: 'default', name: 'Default Project' }),
      ],
    })

    function T() {
      const { active } = useProject()
      return <div data-testid="aid">{active?.id ?? ''}</div>
    }

    render(
      <ProjectProvider>
        <T />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('aid').textContent).toBe('proj_default')
    })
    expect(projectsApi.listProjects.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('restores last-used project id from localStorage when present in the list', async () => {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, 'p_alpha')
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [
        makeProject({ id: 'proj_default', slug: 'default', name: 'Default Project' }),
        makeProject({ id: 'p_alpha', slug: 'alpha', name: 'Alpha' }),
      ],
    })

    function T() {
      const { active } = useProject()
      return <div data-testid="aid">{active?.id ?? ''}</div>
    }

    render(
      <ProjectProvider>
        <T />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('aid').textContent).toBe('p_alpha')
    })
  })

  it('setActiveById updates active project and persists to localStorage', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [
        makeProject({ id: 'p_one', slug: 'one', name: 'One' }),
        makeProject({ id: 'p_two', slug: 'two', name: 'Two' }),
      ],
    })

    function T() {
      const { active, setActiveById } = useProject()
      return (
        <div>
          <div data-testid="aid">{active?.id ?? ''}</div>
          <button type="button" onClick={() => setActiveById('p_two')}>
            switch
          </button>
        </div>
      )
    }

    render(
      <ProjectProvider>
        <T />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('aid').textContent).toBe('p_one')
    })

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))
    expect(screen.getByTestId('aid').textContent).toBe('p_two')
    expect(localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)).toBe('p_two')
  })

  it('createProject calls the API and prepends the new project to the list', async () => {
    const existing = makeProject({ id: 'p_old', slug: 'old', name: 'Old' })
    const created = makeProject({ id: 'p_new', slug: 'new', name: 'New' })

    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [existing],
    })
    const createSpy = vi.spyOn(projectsApi, 'createProject').mockResolvedValue({
      ok: true,
      item: created,
    })

    function T() {
      const { projects, createProject } = useProject()
      return (
        <div>
          <div data-testid="order">{projects.map((p) => p.id).join(',')}</div>
          <button
            type="button"
            onClick={() => {
              void createProject({ slug: 'new', name: 'New' })
            }}
          >
            create
          </button>
        </div>
      )
    }

    render(
      <ProjectProvider>
        <T />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('order').textContent).toBe('p_old')
    })

    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => {
      expect(screen.getByTestId('order').textContent).toBe('p_new,p_old')
    })
    expect(createSpy).toHaveBeenCalledWith({ slug: 'new', name: 'New' })
  })

  it('when offline (list fails), exposes a single virtual default project without throwing', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockRejectedValue(new Error('network'))

    function T() {
      const { active, projects } = useProject()
      return (
        <div>
          <div data-testid="aid">{active?.id ?? ''}</div>
          <div data-testid="count">{projects.length}</div>
        </div>
      )
    }

    expect(() =>
      render(
        <ProjectProvider>
          <T />
        </ProjectProvider>,
      ),
    ).not.toThrow()

    await waitFor(() => {
      expect(screen.getByTestId('aid').textContent).toBe('proj_default')
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
  })

  it('falls back from stale localStorage id to proj_default when last-used is missing from list', async () => {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, 'missing_id')
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [
        makeProject({ id: 'proj_default', slug: 'default', name: 'Default Project' }),
      ],
    })

    function T() {
      const { active } = useProject()
      return <div data-testid="aid">{active?.id ?? ''}</div>
    }

    render(
      <ProjectProvider>
        <T />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('aid').textContent).toBe('proj_default')
    })
  })
})
