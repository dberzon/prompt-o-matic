import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readSqlFile(id) {
  return fs.readFileSync(path.join(__dirname, `${id}.sql`), 'utf-8')
}

// Strips `--` line comments and splits on `;` into individual statements.
// Assumes no semicolons inside string literals (true for all migrations
// shipped from this folder; enforced by code review).
function splitStatements(sql) {
  const withoutLineComments = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--')
      return idx >= 0 ? line.slice(0, idx) : line
    })
    .join('\n')
  return withoutLineComments
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0)
}

// Ordered list of file-based migrations. New migrations append here; each
// entry maps to a sibling `<id>.sql` file in this folder.
export const FILE_MIGRATIONS = [
  { id: '2026-05-add-projects', sql: readSqlFile('2026-05-add-projects') },
  { id: '2026-05-bible-snapshots', sql: readSqlFile('2026-05-bible-snapshots') },
  { id: '2026-05-character-bank-project', sql: readSqlFile('2026-05-character-bank-project') },
]

// Flat ordered list of individual SQL statements across all file migrations.
// Appended to schema.js MIGRATIONS so the existing per-statement try/catch
// loop in sqlite.js initializeDatabase handles idempotency uniformly.
export const FILE_MIGRATION_STATEMENTS = FILE_MIGRATIONS.flatMap((m) => splitStatements(m.sql))
