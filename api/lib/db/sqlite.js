import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { CREATE_TABLES_SQL, MIGRATIONS } from './schema.js'

const DEFAULT_DB_PATH = './data/qpb-local.sqlite'

export function resolveDbPath(env = process.env) {
  const configured = env.SQLITE_DB_PATH || DEFAULT_DB_PATH
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
}

function assertLocalMode(env = process.env) {
  const mode = String(env.APP_MODE || 'local-studio')
  if (mode === 'cloud') {
    const err = new Error('SQLite canonical storage is local-studio only; APP_MODE=cloud is not supported for persistent local files')
    err.status = 400
    throw err
  }
}

export function createSqliteDatabase({ env = process.env, dbPath } = {}) {
  assertLocalMode(env)
  const resolvedPath = dbPath || resolveDbPath(env)
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
  const db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function runLegacyProjectNullBackfillOnce(db) {
  try {
    if (
      db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__qpb_legacy_project_id_backfill'",
        )
        .get()
    ) {
      return
    }
    const run = db.transaction(() => {
      db.prepare("UPDATE entities SET project_id = 'proj_default' WHERE project_id IS NULL").run()
      db.prepare("UPDATE characters SET project_id = 'proj_default' WHERE project_id IS NULL").run()
      db.prepare("UPDATE prompt_packs SET project_id = 'proj_default' WHERE project_id IS NULL").run()
      db.prepare("UPDATE generated_images SET project_id = 'proj_default' WHERE project_id IS NULL").run()
      try {
        db.prepare("UPDATE character_bank_entries SET project_id = 'proj_default' WHERE project_id IS NULL").run()
      } catch {
        /* character_bank_entries.project_id may not exist on very old DBs */
      }
      db.exec('CREATE TABLE __qpb_legacy_project_id_backfill (done INTEGER PRIMARY KEY CHECK (done = 1))')
    })
    run()
  } catch {
    /* ignore — partial schema during first boot */
  }
}

/**
 * Expand `entities.type` CHECK constraint to include `location` and `era`
 * (one-time upgrade for DBs created before those types existed).
 */
function expandEntityTypesIfNeeded(db) {
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entities'").get()
    if (!row?.sql || String(row.sql).includes("'location'")) return
    db.pragma('foreign_keys = OFF')
    db.exec('DROP TABLE IF EXISTS __entities_retype')
    db.exec(`
      CREATE TABLE __entities_retype (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('character', 'environment', 'prop', 'institution', 'location', 'era')),
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        project_id TEXT
      )
    `)
    db.exec(`
      INSERT INTO __entities_retype (id, type, name, created_at, updated_at, archived_at, project_id)
      SELECT id, type, name, created_at, updated_at, archived_at, project_id FROM entities
    `)
    db.exec('DROP TABLE entities')
    db.exec('ALTER TABLE __entities_retype RENAME TO entities')
    db.exec('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities(project_id)')
  } catch {
    /* best-effort — leave table unchanged if rebuild fails */
  } finally {
    try {
      db.pragma('foreign_keys = ON')
    } catch {
      /* ignore */
    }
  }
}

export function initializeDatabase(db) {
  db.exec(CREATE_TABLES_SQL)
  for (const migration of MIGRATIONS) {
    try { db.exec(migration) } catch { /* column already exists */ }
  }
  expandEntityTypesIfNeeded(db)
  runLegacyProjectNullBackfillOnce(db)
  runDataBackfills(db)
}

function backfillCharacterSlugs(db) {
  const rows = db.prepare('SELECT id, payload_json FROM characters WHERE slug IS NULL').all()
  if (rows.length === 0) return 0
  const existsStmt = db.prepare('SELECT 1 FROM characters WHERE slug = ? LIMIT 1')
  const updateStmt = db.prepare('UPDATE characters SET slug = ? WHERE id = ?')
  const used = new Set()
  let updated = 0
  for (const row of rows) {
    let payload
    try { payload = JSON.parse(row.payload_json) } catch { continue }
    const name = payload?.name
    if (!name || typeof name !== 'string') continue
    const base = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    if (!base) continue
    let slug = base
    let n = 2
    while (used.has(slug) || existsStmt.get(slug)) {
      slug = `${base}_${n++}`
      if (n > 999) { slug = `${base}_${Date.now()}`; break }
    }
    used.add(slug)
    const next = { ...payload, slug }
    updateStmt.run(slug, row.id)
    db.prepare('UPDATE characters SET payload_json = ? WHERE id = ?').run(JSON.stringify(next), row.id)
    updated++
  }
  return updated
}

export function runDataBackfills(db) {
  try { backfillCharacterSlugs(db) } catch { /* ignore — column may not exist yet on a fresh db before migrations */ }
}
