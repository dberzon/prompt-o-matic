-- 2026-05-bible-snapshots
-- C5 bible versioning: immutable snapshots per entity (optional project scope).
-- Depends on projects + entities (project_id FK) from 2026-05-add-projects.
--
-- Idempotency: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS bible_snapshots (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  project_id TEXT REFERENCES projects(id),
  label TEXT NOT NULL,
  bible_json TEXT NOT NULL,
  parent_snapshot_id TEXT REFERENCES bible_snapshots(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bible_snapshots_entity ON bible_snapshots(entity_id);

CREATE INDEX IF NOT EXISTS idx_bible_snapshots_project ON bible_snapshots(project_id);
