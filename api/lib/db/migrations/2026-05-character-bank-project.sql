-- 2026-05-character-bank-project
-- Adds project scoping for character bank entries (aligns with entities / characters / packs / images).
ALTER TABLE character_bank_entries ADD COLUMN project_id TEXT REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_character_bank_entries_project_id ON character_bank_entries(project_id);
