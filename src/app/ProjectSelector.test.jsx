/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as projectsApi from '../lib/api/projects.js'
import { ACTIVE_PROJECT_STORAGE_KEY, ProjectProvider } from '../context/ProjectContext.jsx'
import ProjectSelector from './ProjectSelector.jsx'

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

describe('ProjectSelector', () => {
  it('lists only active projects and highlights the current selection', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [
        makeProject({ id: 'p_arch', slug: 'old', name: 'Archived', active: false }),
        makeProject({ id: 'p_a', slug: 'a', name: 'Alpha' }),
        makeProject({ id: 'p_b', slug: 'b', name: 'Beta' }),
      ],
    })

    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, 'p_b')

    render(
      <ProjectProvider>
        <ProjectSelector />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))

    const alpha = await screen.findByRole('option', { name: 'Alpha' })
    const beta = screen.getByRole('option', { name: 'Beta' })
    expect(alpha.getAttribute('aria-selected')).toBe('false')
    expect(beta.getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('option', { name: 'Archived' })).toBeNull()
  })

  it('selecting a project switches the active project', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [
        makeProject({ id: 'p_one', slug: 'one', name: 'One' }),
        makeProject({ id: 'p_two', slug: 'two', name: 'Two' }),
      ],
    })

    render(
      <ProjectProvider>
        <ProjectSelector />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'One' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'One' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Two' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Two' })).toBeTruthy()
    })
    expect(localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)).toBe('p_two')
  })

  it('create flow submits slug and name then switches to the new project', async () => {
    const existing = makeProject({ id: 'p_old', slug: 'old', name: 'Old' })
    const created = makeProject({ id: 'p_new', slug: 'new-film', name: 'New Film' })

    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue({
      ok: true,
      items: [existing],
    })
    const createSpy = vi.spyOn(projectsApi, 'createProject').mockResolvedValue({
      ok: true,
      item: created,
    })

    render(
      <ProjectProvider>
        <ProjectSelector />
      </ProjectProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Old' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Old' }))
    fireEvent.click(screen.getByRole('button', { name: 'New project…' }))

    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'new-film' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Film' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ slug: 'new-film', name: 'New Film' })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Film' })).toBeTruthy()
    })
    expect(localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)).toBe('p_new')
  })
})
