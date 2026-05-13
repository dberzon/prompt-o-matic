import { getProjectById } from '../db/repositories/projects.js'

/** Query string key for per-request project override (`?projectId=...`). */
export const PROJECT_ID_QUERY_PARAM = 'projectId'

/** Header carrying project id when query param is absent. */
export const PROJECT_ID_HEADER = 'x-qpb-project-id'

/** Thrown when the resolved project id has no row in `projects`. */
export class ProjectNotFoundError extends Error {
  /** @param {string} projectId */
  constructor(projectId) {
    super(`Project not found: ${projectId}`)
    this.name = 'ProjectNotFoundError'
    this.code = 'PROJECT_NOT_FOUND'
    this.status = 404
    /** Resolved id that was looked up */
    this.projectId = projectId
  }
}

/**
 * @param {import('http').IncomingHttpHeaders | undefined} headers
 * @param {string} name lower-case header name
 */
function firstHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const raw = headers[name]
  if (raw == null) return ''
  const s = Array.isArray(raw) ? raw[0] : raw
  return String(s).trim()
}

/**
 * @param {{ url?: string } | undefined} req
 * @param {string} paramName
 */
function queryParam(req, paramName) {
  if (!req?.url) return ''
  try {
    const url = new URL(req.url, 'http://localhost')
    const v = url.searchParams.get(paramName)
    return v == null ? '' : String(v).trim()
  } catch {
    return ''
  }
}

/**
 * Resolves which project a request targets, then loads it from SQLite.
 *
 * Precedence: `?projectId=` → `x-qpb-project-id` → `env.QPB_DEFAULT_PROJECT_ID` → `'proj_default'`.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ req?: { url?: string; headers?: import('http').IncomingHttpHeaders }; env?: NodeJS.ProcessEnv }} [opts]
 * @returns {NonNullable<ReturnType<typeof getProjectById>>}
 */
export function resolveActiveProject(db, opts = {}) {
  const env = opts.env ?? process.env

  const fromQuery = queryParam(opts.req, PROJECT_ID_QUERY_PARAM)
  if (fromQuery) {
    const row = getProjectById(db, fromQuery)
    if (!row) throw new ProjectNotFoundError(fromQuery)
    return row
  }

  const fromHeader = firstHeaderValue(opts.req?.headers, PROJECT_ID_HEADER)
  if (fromHeader) {
    const row = getProjectById(db, fromHeader)
    if (!row) throw new ProjectNotFoundError(fromHeader)
    return row
  }

  const fromEnv = String(env.QPB_DEFAULT_PROJECT_ID ?? '').trim()
  if (fromEnv) {
    const row = getProjectById(db, fromEnv)
    if (!row) throw new ProjectNotFoundError(fromEnv)
    return row
  }

  const fallbackId = 'proj_default'
  const row = getProjectById(db, fallbackId)
  if (!row) throw new ProjectNotFoundError(fallbackId)
  return row
}

/**
 * When present, list/read routes should restrict rows to `project_id = id OR project_id IS NULL`.
 * Unlike {@link resolveActiveProject}, this does **not** fall back to env or `proj_default`:
 * omitting both query and header means no filter (backward compatible).
 *
 * Precedence: `?projectId=` → `x-qpb-project-id`.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ req?: { url?: string; headers?: import('http').IncomingHttpHeaders }; env?: NodeJS.ProcessEnv }} [opts]
 * @returns {string | null} validated project id, or null when unset
 */
export function resolveExplicitProjectIdForFiltering(db, opts = {}) {
  const fromQuery = queryParam(opts.req, PROJECT_ID_QUERY_PARAM)
  if (fromQuery) {
    const row = getProjectById(db, fromQuery)
    if (!row) throw new ProjectNotFoundError(fromQuery)
    return fromQuery
  }
  const fromHeader = firstHeaderValue(opts.req?.headers, PROJECT_ID_HEADER)
  if (fromHeader) {
    const row = getProjectById(db, fromHeader)
    if (!row) throw new ProjectNotFoundError(fromHeader)
    return fromHeader
  }
  return null
}

/**
 * Vite passes `req.url`; some tests use Express-style `req.query` without `url`.
 * Builds a synthetic URL so {@link queryParam} can read `?projectId=`.
 *
 * @param {{ url?: string; query?: Record<string, unknown> }} req
 */
export function normalizeRequestUrlForProjectQuery(req) {
  if (req?.url && String(req.url).trim() !== '') return String(req.url)
  const q = req?.query
  if (!q || typeof q !== 'object') return '/'
  const sp = new URLSearchParams()
  for (const [k, raw] of Object.entries(q)) {
    if (raw == null) continue
    const v = Array.isArray(raw) ? raw[0] : raw
    if (v === '' || v == null) continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `/?${s}` : '/'
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ url?: string; query?: Record<string, unknown>; headers?: import('http').IncomingHttpHeaders }} req
 */
export function resolveExplicitProjectIdForRequest(db, req) {
  const url = normalizeRequestUrlForProjectQuery(req)
  return resolveExplicitProjectIdForFiltering(db, { req: { url, headers: req?.headers } })
}
