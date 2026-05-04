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

CREATE TABLE IF NOT EXISTS actor_candidates (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'available',
  source_bank_entry_id TEXT,
  prompt_pack_id TEXT,
  notes TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actor_candidates_status ON actor_candidates(status);
CREATE INDEX IF NOT EXISTS idx_actor_candidates_source_bank_entry_id ON actor_candidates(source_bank_entry_id);
CREATE INDEX IF NOT EXISTS idx_actor_candidates_prompt_pack_id ON actor_candidates(prompt_pack_id);
CREATE INDEX IF NOT EXISTS idx_actor_candidates_created_at ON actor_candidates(created_at);

CREATE TABLE IF NOT EXISTS actor_auditions (
  id TEXT PRIMARY KEY,
  actor_candidate_id TEXT NOT NULL,
  bank_entry_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rejected_reason TEXT,
  similarity_score REAL,
  notes TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (actor_candidate_id, bank_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_actor_auditions_actor_candidate_id ON actor_auditions(actor_candidate_id);
CREATE INDEX IF NOT EXISTS idx_actor_auditions_bank_entry_id ON actor_auditions(bank_entry_id);
CREATE INDEX IF NOT EXISTS idx_actor_auditions_status ON actor_auditions(status);
`

export const MIGRATIONS = [
  'ALTER TABLE characters ADD COLUMN archived_at TEXT',
  "ALTER TABLE characters ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'auditioned'",
  'CREATE INDEX IF NOT EXISTS idx_characters_lifecycle ON characters(lifecycle_status)',
  'ALTER TABLE character_batch_candidates ADD COLUMN preview_image_url TEXT',
  'ALTER TABLE characters ADD COLUMN last_rendered_at TEXT',
  `CREATE TABLE IF NOT EXISTS comfy_jobs (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL UNIQUE,
    character_id TEXT NOT NULL,
    view_type TEXT NOT NULL,
    job_type TEXT NOT NULL,
    prompt_pack_id TEXT,
    workflow_version TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL,
    completed_at TEXT
  )`,
]
