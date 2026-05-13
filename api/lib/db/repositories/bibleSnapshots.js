import { randomUUID } from 'node:crypto'

function nowIso() {
  return new Date().toISOString()
}

/** @param {unknown} bibleJson */
function bibleJsonToStoredString(bibleJson) {
  if (typeof bibleJson === 'string') return bibleJson
  return JSON.stringify(bibleJson)
}

function rowToSnapshotRecord(row) {
  if (!row) return null
  let bibleJson
  try {
    bibleJson = JSON.parse(row.bible_json)
  } catch {
    bibleJson = null
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    projectId: row.project_id ?? null,
    label: row.label,
    bibleJson,
    parentSnapshotId: row.parent_snapshot_id ?? null,
    createdAt: row.created_at,
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ entityId: string, projectId?: string | null, label: string, bibleJson: unknown, parentSnapshotId?: string | null }} input
 */
export function createBibleSnapshot(db, { entityId, projectId = null, label, bibleJson, parentSnapshotId = null }) {
  const id = randomUUID()
  const createdAt = nowIso()
  const bibleJsonStr = bibleJsonToStoredString(bibleJson)
  db.prepare(`
    INSERT INTO bible_snapshots (id, entity_id, project_id, label, bible_json, parent_snapshot_id, created_at)
    VALUES (@id, @entity_id, @project_id, @label, @bible_json, @parent_snapshot_id, @created_at)
  `).run({
    id,
    entity_id: entityId,
    project_id: projectId ?? null,
    label,
    bible_json: bibleJsonStr,
    parent_snapshot_id: parentSnapshotId,
    created_at: createdAt,
  })
  return getBibleSnapshot(db, id)
}

/** @param {import('better-sqlite3').Database} db */
export function getBibleSnapshot(db, id) {
  const row = db.prepare('SELECT * FROM bible_snapshots WHERE id = ?').get(id)
  return rowToSnapshotRecord(row)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ entityId?: string, projectId?: string, label?: string }} [filters]
 */
export function listBibleSnapshots(db, filters = {}) {
  const clauses = []
  const values = []
  if (filters.entityId) {
    clauses.push('entity_id = ?')
    values.push(filters.entityId)
  }
  if (filters.projectId) {
    clauses.push('project_id = ?')
    values.push(filters.projectId)
  }
  if (filters.label) {
    clauses.push('label = ?')
    values.push(filters.label)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM bible_snapshots ${whereSql} ORDER BY datetime(created_at) DESC, id DESC`).all(...values)
  return rows.map((row) => rowToSnapshotRecord(row))
}
