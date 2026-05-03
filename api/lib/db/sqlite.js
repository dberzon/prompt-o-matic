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
  return db
}

export function initializeDatabase(db) {
  db.exec(CREATE_TABLES_SQL)
  for (const migration of MIGRATIONS) {
    try { db.exec(migration) } catch { /* column already exists */ }
  }
}
