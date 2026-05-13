import { randomUUID } from 'node:crypto'

function nowIso() {
  return new Date().toISOString()
}

/** Thrown when an insert/update violates a UNIQUE constraint (e.g. duplicate slug). */
export class UniqueConstraintError extends Error {
  /** @param {string} message @param {{ cause?: unknown }} [opts] */
  constructor(message, opts = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'UniqueConstraintError'
    this.code = 'SQLITE_CONSTRAINT_UNIQUE'
  }
}

/** @param {import('better-sqlite3').Database.RunResult} result */
function assertInserted(result) {
  if (result.changes !== 1) {
    throw new Error('Expected exactly one row inserted')
  }
}

/** @param {Record<string, unknown> | undefined} row */
function rowToProject(row) {
  if (!row) return null
  let payload = null
  if (row.payload_json != null && row.payload_json !== '') {
    try {
      payload = JSON.parse(String(row.payload_json))
    } catch {
      payload = null
    }
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eraEntityId: row.era_entity_id ?? null,
    active: Boolean(row.active),
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ slug: string, name: string, eraEntityId?: string | null, payload?: unknown }} input
 */
export function createProject(db, { slug, name, eraEntityId = null, payload = null }) {
  const id = randomUUID()
  const createdAt = nowIso()
  const updatedAt = createdAt
  const payloadJson = payload == null ? null : JSON.stringify(payload)
  const active = 1
  try {
    const result = db
      .prepare(
        `
      INSERT INTO projects (id, slug, name, era_entity_id, active, payload_json, created_at, updated_at)
      VALUES (@id, @slug, @name, @era_entity_id, @active, @payload_json, @created_at, @updated_at)
    `,
      )
      .run({
        id,
        slug,
        name,
        era_entity_id: eraEntityId ?? null,
        active,
        payload_json: payloadJson,
        created_at: createdAt,
        updated_at: updatedAt,
      })
    assertInserted(result)
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new UniqueConstraintError(`Project slug already exists: ${slug}`, { cause: err })
    }
    throw err
  }
  return getProjectById(db, id)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ active?: boolean }} [filters]
 */
export function listProjects(db, filters = {}) {
  let rows
  if (filters.active === true) {
    rows = db
      .prepare(
        `
      SELECT id, slug, name, era_entity_id, active, payload_json, created_at, updated_at
      FROM projects
      WHERE active = 1
      ORDER BY datetime(created_at) DESC, id DESC
    `,
      )
      .all()
  } else if (filters.active === false) {
    rows = db
      .prepare(
        `
      SELECT id, slug, name, era_entity_id, active, payload_json, created_at, updated_at
      FROM projects
      WHERE active = 0
      ORDER BY datetime(created_at) DESC, id DESC
    `,
      )
      .all()
  } else {
    rows = db
      .prepare(
        `
      SELECT id, slug, name, era_entity_id, active, payload_json, created_at, updated_at
      FROM projects
      ORDER BY datetime(created_at) DESC, id DESC
    `,
      )
      .all()
  }
  return rows.map((row) => rowToProject(row))
}

/** @param {import('better-sqlite3').Database} db */
export function getProjectById(db, id) {
  const row = db
    .prepare(
      `
    SELECT id, slug, name, era_entity_id, active, payload_json, created_at, updated_at
    FROM projects
    WHERE id = ?
  `,
    )
    .get(id)
  return rowToProject(row)
}

/** @param {import('better-sqlite3').Database} db */
export function getProjectBySlug(db, slug) {
  const row = db
    .prepare(
      `
    SELECT id, slug, name, era_entity_id, active, payload_json, created_at, updated_at
    FROM projects
    WHERE slug = ?
  `,
    )
    .get(slug)
  return rowToProject(row)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} id
 * @param {{ name?: string, slug?: string, eraEntityId?: string | null, payload?: unknown, active?: boolean }} patch
 */
export function updateProject(db, id, patch) {
  const current = getProjectById(db, id)
  if (!current) return null

  const next = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
    ...(patch.eraEntityId !== undefined ? { eraEntityId: patch.eraEntityId } : {}),
    ...(patch.payload !== undefined ? { payload: patch.payload } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    updatedAt: nowIso(),
  }

  const payloadJson = next.payload == null ? null : JSON.stringify(next.payload)

  try {
    db.prepare(
      `
      UPDATE projects
      SET slug = @slug,
          name = @name,
          era_entity_id = @era_entity_id,
          active = @active,
          payload_json = @payload_json,
          updated_at = @updated_at
      WHERE id = @id
    `,
    ).run({
      id: next.id,
      slug: next.slug,
      name: next.name,
      era_entity_id: next.eraEntityId ?? null,
      active: next.active ? 1 : 0,
      payload_json: payloadJson,
      updated_at: next.updatedAt,
    })
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new UniqueConstraintError(`Project slug already exists: ${next.slug}`, { cause: err })
    }
    throw err
  }

  return getProjectById(db, id)
}

/** @param {import('better-sqlite3').Database} db */
export function archiveProject(db, id) {
  const updatedAt = nowIso()
  const result = db
    .prepare(
      `
    UPDATE projects
    SET active = 0, updated_at = @updated_at
    WHERE id = @id
  `,
    )
    .run({ id, updated_at: updatedAt })
  if (result.changes !== 1) {
    throw new Error(`archiveProject: no project with id ${id}`)
  }
  return { ok: true }
}
