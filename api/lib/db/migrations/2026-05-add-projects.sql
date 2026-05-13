-- 2026-05-add-projects
-- Implements C5 root from the Phase-3 architecture plan:
--   * Adds the projects table (id, slug, name, era_entity_id, active, payload_json, timestamps).
--   * Adds entities.project_id FK column + index.
--   * Seeds a single default project (id='proj_default', slug='default').
--   * Legacy NULL `project_id` backfill (one-time) is handled in sqlite.js
--     (`runLegacyProjectNullBackfillOnce`) so per-request re-init does not
--     overwrite intentional NULLs used as cross-project rows.
--
-- Idempotency: every statement is either inherently idempotent
-- (CREATE ... IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, INSERT OR IGNORE)
-- or — in the case of the single
-- ALTER TABLE ADD COLUMN, which SQLite cannot guard with IF NOT EXISTS —
-- swallowed by the per-statement try/catch in sqlite.js initializeDatabase.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  era_entity_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE entities ADD COLUMN project_id TEXT REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities(project_id);

INSERT OR IGNORE INTO projects (id, slug, name, active, created_at, updated_at)
VALUES ('proj_default', 'default', 'Default Project', 1, '2026-05-13T00:00:00.000Z', '2026-05-13T00:00:00.000Z');

-- One-time NULL → proj_default backfill runs in sqlite.js (`runLegacyProjectNullBackfillOnce`)
-- so repeated `initializeDatabase` (e.g. per HTTP request) does not clobber intentional NULLs.
