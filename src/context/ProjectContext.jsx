import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createProject as createProjectApi, listProjects } from '../lib/api/projects.js'

/** @type {import('../lib/api/projects.js').ProjectRecord} */
const OFFLINE_VIRTUAL_DEFAULT = {
  id: 'proj_default',
  slug: 'default',
  name: 'Default Project',
  eraEntityId: null,
  active: true,
  payload: null,
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
}

export const ACTIVE_PROJECT_STORAGE_KEY = 'qpb.activeProjectId'

/**
 * @param {import('../lib/api/projects.js').ProjectRecord[]} items
 * @param {string | null} storedId
 * @returns {import('../lib/api/projects.js').ProjectRecord | null}
 */
function pickActiveProject(items, storedId) {
  if (!items.length) return null
  const trimmed = (storedId ?? '').trim()
  if (trimmed) {
    const byStored = items.find((p) => p.id === trimmed)
    if (byStored) return byStored
  }
  const byDefault = items.find((p) => p.id === 'proj_default')
  if (byDefault) return byDefault
  return items[0] ?? null
}

function readStoredProjectId() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) : null
  } catch {
    return null
  }
}

function writeStoredProjectId(id) {
  try {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id)
  } catch {
    /* private mode / disabled storage */
  }
}

const ProjectContext = createContext(null)

/**
 * @typedef {{
 *   active: import('../lib/api/projects.js').ProjectRecord | null,
 *   projects: import('../lib/api/projects.js').ProjectRecord[],
 *   setActiveById: (id: string) => void,
 *   createProject: (input: { slug: string, name: string }) => Promise<import('../lib/api/projects.js').ProjectRecord>,
 * }} ProjectContextValue
 */

/** @param {{ children: import('react').ReactNode }} props */
export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState(() => [])
  const [active, setActive] = useState(() => null)
  const projectsRef = useRef(projects)
  projectsRef.current = projects

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await listProjects()
        if (cancelled) return
        const items = Array.isArray(res?.items) ? res.items : []
        if (items.length === 0) {
          const fallback = [OFFLINE_VIRTUAL_DEFAULT]
          setProjects(fallback)
          setActive(OFFLINE_VIRTUAL_DEFAULT)
          writeStoredProjectId(OFFLINE_VIRTUAL_DEFAULT.id)
          return
        }
        setProjects(items)
        const chosen = pickActiveProject(items, readStoredProjectId())
        if (chosen) {
          setActive(chosen)
          writeStoredProjectId(chosen.id)
        } else {
          setActive(null)
        }
      } catch {
        if (cancelled) return
        const fallback = [OFFLINE_VIRTUAL_DEFAULT]
        setProjects(fallback)
        setActive(OFFLINE_VIRTUAL_DEFAULT)
        writeStoredProjectId(OFFLINE_VIRTUAL_DEFAULT.id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setActiveById = useCallback((id) => {
    const match = projectsRef.current.find((p) => p.id === id)
    if (!match) return
    setActive(match)
    writeStoredProjectId(id)
  }, [])

  const createProject = useCallback(async ({ slug, name }) => {
    const res = await createProjectApi({ slug, name })
    const item = res.item
    setProjects((prev) => [item, ...prev])
    return item
  }, [])

  const value = useMemo(
    () => ({
      active,
      projects,
      setActiveById,
      createProject,
    }),
    [active, projects, setActiveById, createProject],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

/** @returns {ProjectContextValue} */
export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return ctx
}
