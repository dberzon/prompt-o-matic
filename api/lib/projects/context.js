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
