export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  embedding_status TEXT NOT NULL DEFAULT 'not_indexed',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_created_at ON characters(created_at);

CREATE TABLE IF NOT EXISTS prompt_packs (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  project_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_packs_character_id ON prompt_packs(character_id);
CREATE INDEX IF NOT EXISTS idx_prompt_packs_project_id ON prompt_packs(project_id);

CREATE TABLE IF NOT EXISTS generated_images (
  id TEXT PRIMARY KEY,
  character_id TEXT,
  prompt_pack_id TEXT NOT NULL,
  project_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generated_images_character_id ON generated_images(character_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_prompt_pack_id ON generated_images(prompt_pack_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_project_id ON generated_images(project_id);

CREATE TABLE IF NOT EXISTS character_batches (
  id TEXT PRIMARY KEY,
  request_json TEXT NOT NULL,
  options_json TEXT NOT NULL,
  provider_json TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_character_batches_status ON character_batches(status);
CREATE INDEX IF NOT EXISTS idx_character_batches_created_at ON character_batches(created_at);

CREATE TABLE IF NOT EXISTS character_batch_candidates (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_candidate_id TEXT,
  candidate_json TEXT NOT NULL,
  classification TEXT NOT NULL,
  review_status TEXT NOT NULL,
  similarity_json TEXT,
  errors_json TEXT,
  mutation_json TEXT,
  generation_round INTEGER NOT NULL DEFAULT 1,
  saved_character_id TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_candidates_batch_id ON character_batch_candidates(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_candidates_source_candidate_id ON character_batch_candidates(source_candidate_id);
CREATE INDEX IF NOT EXISTS idx_batch_candidates_classification ON character_batch_candidates(classification);
CREATE INDEX IF NOT EXISTS idx_batch_candidates_review_status ON character_batch_candidates(review_status);

CREATE TABLE IF NOT EXISTS character_bank_entries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  optimized_description TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_character_bank_entries_slug ON character_bank_entries(slug);
CREATE INDEX IF NOT EXISTS idx_character_bank_entries_created_at ON character_bank_entries(created_at);
`
