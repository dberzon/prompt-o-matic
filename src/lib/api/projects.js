import { apiGet, apiPost } from './http.js'

/**
 * @typedef {{ id: string, slug: string, name: string, eraEntityId?: string | null, active: boolean, payload?: unknown, createdAt: string, updatedAt: string }} ProjectRecord
 */

/**
 * @returns {Promise<{ ok: true, items: ProjectRecord[] }>}
 */
export function listProjects() {
  return apiGet('/api/projects')
}

/**
 * @param {{ slug: string, name: string }} body
 * @returns {Promise<{ ok: true, item: ProjectRecord }>}
 */
export function createProject(body) {
  return apiPost('/api/projects', body)
}

/**
 * @param {string} id
 * @returns {Promise<{ ok: true, item: ProjectRecord }>}
 */
export function getProject(id) {
  return apiGet(`/api/projects/${encodeURIComponent(id)}`)
}
