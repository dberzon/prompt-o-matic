# APPLICATION_REFERENCE.md

*Written from source code — May 2026. Updated after P6 (Actor Bank full UI + pv9). Code wins over any other documentation.*

---

## SECTION 1 — Application Overview

Qwen Prompt Builder (QPB) is a local-first creative tool for constructing, managing, and rendering cinematic text-to-image prompts, primarily targeting the Qwen image generation model via a locally-running ComfyUI instance. It is intended for photographers, directors, and creative professionals who want structured control over the visual language of AI-generated images, and for casting/character development work that requires generating and evaluating many AI actor portraits.

**Four tabs and their single jobs:**

- **Prompt Builder** — Constructs and refines a single text-to-image prompt from freetext scene input, director style chips, scenario templates, and an optional LLM polish pass. This is the primary creative composition interface.
- **Character Builder** — Creates and manages named character bank entries that describe a specific person's appearance. These entries are the input for the Casting Room's Path A (audition) flow.
- **Casting Room** — Generates AI actor portfolios through two paths: Path A (audition from bank, LLM generates character variations from a bank entry, then ComfyUI renders them), and Path B (batch generation using vector similarity checking). Also hosts the Active Character section for managing approved characters and queuing portfolio renders.
- **Actor Bank** — Full character management interface for the `characters` table. Grid view with filters (search, gender, age) and sort options. Per-character detail view with: inline rename, archive/restore, image keep/discard curation, portfolio re-queue on failure, and "Open in Casting Room" cross-tab bridge. All management actions that previously required the Casting Room are now available here.

**Dependency relationships between tabs:**

- Character Builder produces bank entries (SQLite `character_bank_entries` table) that Path A in the Casting Room consumes.
- Casting Room produces character records (SQLite `characters` table) and generated images that the Actor Bank displays.
- Prompt Builder reads Actor Bank characters on mount via `GET /api/characters`. These feed two integrations: (1) character slots in DirectorSection can be linked to a named Actor Bank character, replacing the anonymous demographic descriptor in director scenario templates; (2) Actor Bank characters are merged into `effectiveCharacters` so `@slug` tokens in the scene input expand to the character's full `optimizedDescription` from the database (in addition to the existing localStorage Character Builder entries).
- Actor Bank provides a cross-tab "Open in Casting Room" action that switches the active tab to `pipeline` and sets `selectedCharacterId` in `CastingPipelinePanel` via the `jumpToCharacterId` prop.

**External service dependencies:**

| Service | What it enables | What breaks if absent |
|---|---|---|
| ComfyUI (localhost:8188) | Image generation for audition and portfolio renders | All image rendering fails; audition results have no images; portfolio queue returns 502 |
| Ollama (localhost:11434) | Local LLM for polish and character generation; embedding for vector similarity | Polish falls back to cloud; character batch generation fails if no cloud key; vector indexing fails |
| LM Studio (configurable URL) | Alternative local LLM / embedding provider | Same as Ollama if configured as primary |
| Chroma (localhost:8000) | Vector similarity search for batch deduplication | Similarity checks skip silently; Save to Cast re-check bypasses gracefully |
| Anthropic Claude API (cloud) | Cloud LLM fallback for polish and character generation | Cloud polish fails with 4xx if key absent; local providers remain functional |

**Deployment model:** Local-only. The entire application runs on a developer machine. Vite's dev server serves both the React frontend and all API routes as Vite middleware plugins. There is no production server or cloud deployment. The `.env.local` file shows `APP_MODE=local-studio`. A `cloud` mode exists in the access-control code but is not the operative mode.

---

## SECTION 2 — Full Database Schema

The database is SQLite, initialized via `api/lib/db/sqlite.js` using `better-sqlite3`. Schema is defined in `api/lib/db/schema.js`.

### Base tables (from `CREATE_TABLES_SQL`)

---

```
TABLE: characters
  id                TEXT    PRIMARY KEY
  project_id        TEXT    NULL
  embedding_status  TEXT    NOT NULL  DEFAULT 'not_indexed'
  payload_json      TEXT    NOT NULL
  created_at        TEXT    NOT NULL
  updated_at        TEXT    NOT NULL
```

- `payload_json` stores the full character profile object as JSON (all fields including name, age, genderPresentation, cinematicArchetype, lifecycleStatus, embeddingStatus, lastRenderedAt, etc.)
- `embedding_status` reflects vector indexing state; valid values (from code): `not_indexed`, `pending`, `embedded`, `failed`
- `lifecycle_status` does NOT appear in the base table DDL — it was added via migration (see below)

**Indexes:**
```
idx_characters_project_id  ON characters(project_id)
idx_characters_created_at  ON characters(created_at)
```

---

```
TABLE: prompt_packs
  id            TEXT  PRIMARY KEY
  character_id  TEXT  NOT NULL
  project_id    TEXT  NULL
  payload_json  TEXT  NOT NULL
  created_at    TEXT  NOT NULL
  updated_at    TEXT  NOT NULL
```

**Indexes:**
```
idx_prompt_packs_character_id  ON prompt_packs(character_id)
idx_prompt_packs_project_id    ON prompt_packs(project_id)
```

---

```
TABLE: generated_images
  id              TEXT  PRIMARY KEY
  character_id    TEXT  NULL
  prompt_pack_id  TEXT  NOT NULL
  project_id      TEXT  NULL
  payload_json    TEXT  NOT NULL
  created_at      TEXT  NOT NULL
  updated_at      TEXT  NOT NULL
```

**Indexes:**
```
idx_generated_images_character_id   ON generated_images(character_id)
idx_generated_images_prompt_pack_id ON generated_images(prompt_pack_id)
idx_generated_images_project_id     ON generated_images(project_id)
```

---

```
TABLE: character_batches
  id            TEXT  PRIMARY KEY
  request_json  TEXT  NOT NULL
  options_json  TEXT  NOT NULL
  provider_json TEXT  NOT NULL
  summary_json  TEXT  NOT NULL
  status        TEXT  NOT NULL
  created_at    TEXT  NOT NULL
  updated_at    TEXT  NOT NULL
```

- `status` values observed in code: `'generated'`, `'partially_reviewed'`, `'completed'`
- Status is derived automatically by `deriveBatchStatus()` / `recalculateCharacterBatchSummary()` from candidate review statuses

**Indexes:**
```
idx_character_batches_status      ON character_batches(status)
idx_character_batches_created_at  ON character_batches(created_at)
```

---

```
TABLE: character_batch_candidates
  id                    TEXT     PRIMARY KEY
  batch_id              TEXT     NOT NULL
  source_candidate_id   TEXT     NULL
  candidate_json        TEXT     NOT NULL
  classification        TEXT     NOT NULL
  review_status         TEXT     NOT NULL
  similarity_json       TEXT     NULL
  errors_json           TEXT     NULL
  mutation_json         TEXT     NULL
  generation_round      INTEGER  NOT NULL  DEFAULT 1
  saved_character_id    TEXT     NULL
  review_note           TEXT     NULL
  created_at            TEXT     NOT NULL
  updated_at            TEXT     NOT NULL
```

- `classification` valid values: `'accepted'`, `'rejected'`, `'needsMutation'`, `'pendingReview'`
- `review_status` valid values: `'pending'`, `'approved'`, `'rejected'`, `'mutated'`, `'saved'`
- `preview_image_url` — added via MIGRATION (see below)

**Indexes:**
```
idx_batch_candidates_batch_id            ON character_batch_candidates(batch_id)
idx_batch_candidates_source_candidate_id ON character_batch_candidates(source_candidate_id)
idx_batch_candidates_classification      ON character_batch_candidates(classification)
idx_batch_candidates_review_status       ON character_batch_candidates(review_status)
```

---

```
TABLE: character_bank_entries
  id                    TEXT  PRIMARY KEY
  slug                  TEXT  NOT NULL  UNIQUE
  name                  TEXT  NOT NULL
  description           TEXT  NOT NULL
  optimized_description TEXT  NULL
  payload_json          TEXT  NOT NULL
  created_at            TEXT  NOT NULL
  updated_at            TEXT  NOT NULL
```

**Indexes:**
```
idx_character_bank_entries_slug        ON character_bank_entries(slug)
idx_character_bank_entries_created_at  ON character_bank_entries(created_at)
```

---

```
TABLE: actor_candidates
  id                    TEXT  PRIMARY KEY
  status                TEXT  NOT NULL  DEFAULT 'available'
  source_bank_entry_id  TEXT  NULL
  prompt_pack_id        TEXT  NULL
  notes                 TEXT  NULL
  payload_json          TEXT  NOT NULL
  created_at            TEXT  NOT NULL
  updated_at            TEXT  NOT NULL
```

- `status` valid value observed: `'available'`

**Indexes:**
```
idx_actor_candidates_status               ON actor_candidates(status)
idx_actor_candidates_source_bank_entry_id ON actor_candidates(source_bank_entry_id)
idx_actor_candidates_prompt_pack_id       ON actor_candidates(prompt_pack_id)
idx_actor_candidates_created_at           ON actor_candidates(created_at)
```

---

```
TABLE: actor_auditions
  id                  TEXT  PRIMARY KEY
  actor_candidate_id  TEXT  NOT NULL
  bank_entry_id       TEXT  NOT NULL
  status              TEXT  NOT NULL  DEFAULT 'pending'
  rejected_reason     TEXT  NULL
  similarity_score    REAL  NULL
  notes               TEXT  NULL
  payload_json        TEXT  NOT NULL
  created_at          TEXT  NOT NULL
  updated_at          TEXT  NOT NULL

  UNIQUE (actor_candidate_id, bank_entry_id)
```

- `status` valid values: `'pending'`, `'approved'`, `'rejected'` (observed from API usage)

**Indexes:**
```
idx_actor_auditions_actor_candidate_id  ON actor_auditions(actor_candidate_id)
idx_actor_auditions_bank_entry_id       ON actor_auditions(bank_entry_id)
idx_actor_auditions_status              ON actor_auditions(status)
```

---

```
TABLE: saved_prompts
  id          TEXT  PRIMARY KEY
  name        TEXT  NOT NULL
  text        TEXT  NOT NULL
  created_at  TEXT  NOT NULL
  updated_at  TEXT  NOT NULL
```

**Indexes:**
```
idx_saved_prompts_created_at  ON saved_prompts(created_at)
```

---

```
TABLE: workspace_profiles
  id          TEXT  PRIMARY KEY
  label       TEXT  NOT NULL
  state_json  TEXT  NOT NULL
  created_at  TEXT  NOT NULL
  updated_at  TEXT  NOT NULL
```

*(No additional indexes on workspace_profiles.)*

---

### Migration history (`MIGRATIONS` array, applied in order)

1. `ALTER TABLE characters ADD COLUMN archived_at TEXT`
   — Adds soft-archive support. NULL = active; ISO timestamp = archived.

2. `ALTER TABLE characters ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'auditioned'`
   — Adds the lifecycle state machine column. Valid values (from `characterLifecycle.js` and the `/api/character-lifecycle` handler): `'auditioned'`, `'preview'`, `'portfolio_pending'`, `'portfolio_failed'`, `'ready'`

3. `CREATE INDEX IF NOT EXISTS idx_characters_lifecycle ON characters(lifecycle_status)`
   — Index on the new lifecycle_status column.

4. `ALTER TABLE character_batch_candidates ADD COLUMN preview_image_url TEXT`
   — Stores the URL of a preview render for batch candidates. NULL until a preview is generated.

5. `ALTER TABLE characters ADD COLUMN last_rendered_at TEXT`
   — Stores ISO timestamp of the most recent ComfyUI render. Used for sort order in Actor Bank.

6. Creates the `comfy_jobs` table:
```
TABLE: comfy_jobs
  id                TEXT  PRIMARY KEY
  prompt_id         TEXT  NOT NULL  UNIQUE
  character_id      TEXT  NOT NULL
  view_type         TEXT  NOT NULL
  job_type          TEXT  NOT NULL
  prompt_pack_id    TEXT  NULL
  workflow_version  TEXT  NULL
  status            TEXT  NOT NULL  DEFAULT 'queued'
  created_at        TEXT  NOT NULL
  completed_at      TEXT  NULL
```
   — `status` values: `'queued'`, `'running'`, `'success'`, `'failed'`
   — `job_type` values observed: `'audition'`, `'portfolio'`
   — `prompt_id` is UNIQUE and used as the upsert key

### Foreign key relationships

No foreign key constraints are declared in the DDL. Relationships are maintained at the application layer:
- `prompt_packs.character_id` → `characters.id` (by convention, not constraint)
- `generated_images.character_id` → `characters.id` (nullable, by convention)
- `generated_images.prompt_pack_id` → `prompt_packs.id` (by convention)
- `character_batch_candidates.batch_id` → `character_batches.id` (by convention)
- `character_batch_candidates.saved_character_id` → `characters.id` (nullable, set on save)
- `actor_auditions.actor_candidate_id` → `actor_candidates.id` (by convention)
- `actor_auditions.bank_entry_id` → `character_bank_entries.id` (by convention)
- `comfy_jobs.character_id` → `characters.id` (by convention)
- `comfy_jobs.prompt_pack_id` → `prompt_packs.id` (nullable, by convention)

---

## SECTION 3 — Complete API Reference

All routes are registered as Vite dev-server middleware in `vite.config.js`. There is no separate Express/Fastify server. All routes are prefixed `/api/`.

### Environment variables

| Variable | What it controls | Default if absent | Required for |
|---|---|---|---|
| `APP_MODE` | Mode gating. Valid: `local-studio`, `cloud` | `local-studio` | Cloud blocks write ops for batches/ComfyUI |
| `ENABLE_CHARACTER_BATCH_API` | Gates all `/api/character*` batch endpoints | `false` (blocked) | Batch generation, candidates, save |
| `ENABLE_PROMPT_PACK_API` | Gates prompt pack compile/list endpoints | `false` (blocked) | Prompt pack compilation |
| `ENABLE_COMFY_API` | Gates all `/api/comfy*` endpoints | `false` (blocked) | Image rendering |
| `ENABLE_GENERATED_IMAGES_API` | Gates `/api/generated-images`, approve, reject, view | `false` (blocked) | Gallery, image review |
| `ENABLE_VECTOR_MAINTENANCE_API` | Gates `/api/vector-*` endpoints | `false` (blocked) | Vector indexing, similarity search |
| `ANTHROPIC_API_KEY` | Claude API key for cloud polish | None | Cloud LLM polish, cloud character generation |
| `LLM_PROVIDER` | Default LLM for local polish. Valid: `ollama`, `lmstudio`, `mock`, `embedded` | `ollama` | Local polish |
| `LLM_CLOUD_PROVIDER` | Cloud LLM override. Valid: `mock` or defaults to Claude | Claude | Cloud polish testing |
| `OLLAMA_BASE_URL` | Ollama API URL | `http://127.0.0.1:11434` | Local polish via Ollama |
| `OLLAMA_MODEL` | Ollama model for LLM generation | *(default in shared.js)* | Local LLM |
| `OLLAMA_EMBED_MODEL` | Ollama model for embeddings | `nomic-embed-text` | Vector indexing |
| `LMSTUDIO_BASE_URL` | LM Studio API base URL | `http://127.0.0.1:1234/v1` | Local polish via LM Studio |
| `LMSTUDIO_MODEL` | LM Studio model name | `qwen-local` | LM Studio polish |
| `LMSTUDIO_EMBED_MODEL` | LM Studio embedding model | `nomic-embed-text-v1.5` | Embeddings via LM Studio |
| `LMSTUDIO_TIMEOUT_MS` | LM Studio request timeout | `8000` | LM Studio availability |
| `COMFY_BASE_URL` / `COMFYUI_BASE_URL` | ComfyUI base URL | `http://127.0.0.1:8188` | All image rendering |
| `CHROMA_URL` | Chroma vector DB URL | `http://127.0.0.1:8000` | Vector similarity |
| `CHROMA_DATA_PATH` | Chroma data directory for auto-spawn | `./chroma_data` | Chroma auto-start |
| `AUTO_START_CHROMA` | Set to `false` to skip Chroma auto-spawn on dev server start | `true` | CI / Docker / production |
| `CHROMA_COLLECTION_CHARACTERS` | Chroma collection name | `characters` | Vector storage |
| `EMBEDDED_TIMEOUT_MS` | Timeout for embedded sidecar LLM | `180000` (3 min) | Embedded polish |
| `SQLITE_DB_PATH` | Path to SQLite database file | *(default in sqlite.js)* | All DB ops |

---

### Polish

```
POST  /api/polish
Purpose: Rewrite assembled prompt fragments into a unified cinematic prompt via LLM.
Request body: {
  fragments:       string[]   (required — assembled prompt parts)
  directorName:    string     (optional — e.g. "Andrei Tarkovsky")
  directorNote:    string     (optional — director's one-line register note)
  scene:           string     (optional — raw scene description)
  scenario:        string     (optional — selected scenario text)
  narrativeBeat:   string     (optional — ideation seed to translate into static composition)
  frontPrefix:     string     (optional — prefix to prepend if not already present)
  engine:          string     (optional — 'auto'|'local'|'cloud'|'embedded'; default 'auto')
  localOnly:       boolean    (optional)
  localProvider:   string     (optional — 'ollama'|'lmstudio'|'mock')
  lmStudioBaseUrl: string     (optional)
  lmStudioModel:   string     (optional)
  cloudProvider:   string     (optional — 'mock' for testing)
  embeddedPort:    number     (optional — sidecar port)
  embeddedSecret:  string     (optional — sidecar auth token)
  embeddedModel:   string     (optional)
  dryRun:          boolean    (optional — if true, skips LLM call)
}
Response: { polished: string, provider: string, engine: string, fallback: string|null }
Side effects: None (no DB writes)
Auth/gating: None — always available
Error cases: 400 (no fragments), 503 (provider unavailable), 502 (upstream error)
```

```
GET  /api/polish-health
Purpose: Check which LLM provider is available for polish.
Query params: engine, localOnly, embeddedPort, embeddedSecret, embeddedModel, localProvider, lmStudioBaseUrl, lmStudioModel
Response: { engine, localOnly, provider, fallback, local: {...}, lmstudio: {...}, embedded: {...} }
Side effects: None
Auth/gating: None
Error cases: 400 (invalid engine)
```

---

### Characters (CRUD, lifecycle, archive)

```
GET  /api/characters
Purpose: List all characters (with thumbnail URLs), or get a single character with images.
Query params: id (optional, gets single), projectId, gender, search, ageMin, ageMax, includeArchived ('true'|'only'|absent)
Response: { ok: true, items: character[], total: number }  OR  { ok: true, item: { ...character, images: [] } }
Side effects: None
Auth/gating: ENABLE_CHARACTER_BATCH_API required
Error cases: 400 (bad id), 404 (not found)
```

```
DELETE  /api/characters?id=<id>
Purpose: Hard-delete a character record permanently.
Response: { ok: true }
Side effects: Deletes row from characters table
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
Error cases: 400 (missing id), 404 (not found)
```

```
POST  /api/character-lifecycle
Purpose: Transition a character's lifecycleStatus.
Request body: { characterId: string (required), lifecycleStatus: string (required) }
Valid lifecycleStatus values: 'auditioned', 'preview', 'portfolio_pending', 'portfolio_failed', 'ready'
Response: { ok: true, item: updatedCharacter }
Side effects: Updates lifecycle_status column and payload_json in characters table
Auth/gating: None
Error cases: 400 (missing fields or invalid status), 404 (not found)
```

```
POST  /api/character-rename
Purpose: Rename a character.
Request body: { characterId: string (required), name: string (required) }
Response: { ok: true, item: updatedCharacter }
Side effects: Updates name in payload_json in characters table
Auth/gating: None
Error cases: 400 (missing/empty fields), 404 (not found)
```

```
POST  /api/character-archive
Purpose: Soft-archive a character (sets archived_at timestamp).
Request body: { characterId: string (required) }
Response: { ok: true }
Side effects: Sets archived_at to current ISO timestamp in characters table
Auth/gating: None
Error cases: 400 (missing id), 404 (not found)
```

```
POST  /api/character-restore
Purpose: Restore a soft-archived character (clears archived_at).
Request body: { characterId: string (required) }
Response: { ok: true }
Side effects: Sets archived_at = NULL in characters table
Auth/gating: None
Error cases: 400 (missing id), 404 (not found)
```

---

### Casting / Audition (Path A)

```
POST  /api/audition/generate
Purpose: Run the full audition pipeline for a bank entry — generate N character profiles via LLM, create character records, compile prompt packs, queue ComfyUI jobs.
Request body: {
  bankEntryId: string  (required)
  count:       number  (optional, default 3, max 10)
  views:       string[]  (optional, default ['front_portrait', 'profile_portrait'])
  workflowId:  string  (optional)
}
Response: { ok: true, results: auditionResult[], requested: number, successful: number, failed: number }
Each auditionResult: { ok, characterId, views: [{ ok, view, promptPackId, comfyPromptId, ... }] }
Side effects: Creates character rows, actor_candidate rows, actor_audition rows, prompt_pack rows, comfy_jobs rows; queues ComfyUI prompt jobs
Auth/gating: None
Error cases: 400 (missing bankEntryId), 404 (bank entry not found), 503 (LLM unavailable)
```

---

### Batch pipeline (Path B)

```
POST  /api/characters-generate-batch
Purpose: Generate a batch of character candidates via LLM with vector similarity screening.
Request body: {
  request: { count, ageMin, ageMax, gender, cinematicArchetype, projectTone, ... },
  options: { persistBatch, checkSimilarity, mutateSimilar, similarityLimit, maxCandidates },
  provider: { engine, localProvider, model }
}
Response (with persistBatch=true): { ok: true, batchId, summary, candidates: { accepted, rejected, needsMutation } }
Response (without persistBatch): { ok: true, ...fullGenerationResult }
Side effects: If persistBatch=true: creates character_batches row and character_batch_candidates rows
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
Error cases: 503 (LLM/vector unavailable)
```

```
GET  /api/character-batches?status=<status>
Purpose: List all character batches, optionally filtered by status.
Response: { ok: true, items: batch[] }
Auth/gating: ENABLE_CHARACTER_BATCH_API required
```

```
GET  /api/character-batch?id=<id>
Purpose: Get a single batch with full details.
Response: { ok: true, item: batch }
Auth/gating: ENABLE_CHARACTER_BATCH_API required
Error cases: 400 (missing id), 404 (not found)
```

```
GET  /api/character-batch-candidates?batchId=<id>&classification=<val>&reviewStatus=<val>
Purpose: List candidates for a batch, optionally filtered.
Response: { ok: true, items: candidate[] }
Auth/gating: ENABLE_CHARACTER_BATCH_API required
Error cases: 400 (missing batchId)
```

```
POST  /api/character-batch-candidate-approve
Purpose: Mark a candidate as approved (reviewStatus='approved', classification='accepted').
Request body: { candidateId: string }
Response: { ok: true, item: updatedCandidate }
Side effects: Updates candidate row; recalculates batch summary
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
Error cases: 404 (not found)
```

```
POST  /api/character-batch-candidate-reject
Purpose: Mark a candidate as rejected.
Request body: { candidateId: string, reason: string (optional) }
Response: { ok: true, item: updatedCandidate }
Side effects: Sets reviewStatus='rejected', classification='rejected', reviewNote; recalculates batch summary
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
Error cases: 404 (not found)
```

```
POST  /api/character-batch-candidate-reconsider
Purpose: Return a rejected candidate to pending review.
Request body: { candidateId: string }
Response: { ok: true, item: updatedCandidate }
Side effects: Sets reviewStatus='pending', classification='accepted', clears reviewNote; recalculates batch summary
Auth/gating: ENABLE_CHARACTER_BATCH_API required
Error cases: 400 (missing candidateId), 404 (not found)
```

```
POST  /api/character-batch-candidate-save
Purpose: Save an approved candidate as a full character record. Optionally checks vector similarity first.
Request body: { candidateId: string, force: boolean (optional, skips similarity re-check) }
Response (similarity warning): { warning: 'similar_character_found', matches: [...] }
Response (success): { ok: true, item: updatedCandidate }
Side effects: Creates characters row (lifecycleStatus='auditioned'), updates candidate's savedCharacterId and reviewStatus='saved'; triggers async vector reindex
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
Error cases: 400 (candidate not approved), 404 (not found)
```

```
POST  /api/character-batch-candidate-mutate
Purpose: Re-generate a candidate with mutation instructions via LLM.
Request body: { candidateId, reason, mutationInstructions, provider }
Response: mutated candidate record
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
```

```
POST  /api/character-batch-refill
Purpose: Generate additional candidates for a batch to reach a target count.
Request body: { batchId, targetCount, maxNewCandidates, provider, options }
Response: refill result
Auth/gating: ENABLE_CHARACTER_BATCH_API required; cloud mode blocks
```

```
POST  /api/batch-candidate-preview
Purpose: Generate a preview image for an approved batch candidate (creates a temporary character, compiles front_portrait pack, queues ComfyUI job).
Request body: { candidateId: string, workflowId: string (optional) }
Response: { ok: true, candidateId, characterId (temp), promptId, promptPackId }
Side effects: Creates a temporary character row (lifecycleStatus='preview'), creates prompt_pack row, queues ComfyUI job. Temp character is deleted after image is ingested.
Auth/gating: ENABLE_CHARACTER_BATCH_API required
Error cases: 400 (candidate not approved), 404 (not found), 502 (ComfyUI error)
```

```
POST  /api/batch-candidate-preview-image
Purpose: Update the stored preview_image_url on a candidate record after render completes.
Request body: { candidateId: string, previewImageUrl: string|null }
Response: { ok: true, item: updatedCandidate }
Auth/gating: ENABLE_CHARACTER_BATCH_API required
```

---

### Prompt packs

```
POST  /api/prompt-pack-compile-character
Purpose: Compile prompt packs for a character for specified views.
Request body: { characterId: string, views: string[] (optional), workflowId: string (optional), options: {} }
Response: { packs: promptPack[] }
Side effects: Creates prompt_pack rows in database
Auth/gating: ENABLE_PROMPT_PACK_API required
```

```
POST  /api/prompt-pack-compile-batch
Purpose: Compile prompt packs for all candidates in a batch.
Request body: { batchId: string, views: string[] (optional), ... }
Response: compile result
Auth/gating: ENABLE_PROMPT_PACK_API required
```

```
GET  /api/prompt-packs?characterId=<id>
Purpose: List prompt packs for a character.
Response: { items: promptPack[] }
Auth/gating: ENABLE_PROMPT_PACK_API required
```

---

### Portfolio

```
POST  /api/character-portfolio-plan
Purpose: Generate a portfolio plan (what will be queued) without actually queueing.
Request body: { characterId, views, workflowId, options }
Response: portfolio plan
Auth/gating: ENABLE_PROMPT_PACK_API required
```

```
POST  /api/character-portfolio-queue
Purpose: Compile prompt packs and queue all portfolio views to ComfyUI.
Request body: { characterId, views, workflowId, options }
Response: { queued: [...], summary: { success, failed } }
Side effects: Creates prompt_pack rows, queues ComfyUI jobs, persists jobs to comfy_jobs table
Auth/gating: ENABLE_PROMPT_PACK_API + ENABLE_COMFY_API required
```

```
POST  /api/actor-more-takes
Purpose: Queue additional view renders for a character (more takes).
Request body: { characterId: string (or actorCandidateId: string), views: string[], workflowId, options }
Response: { queued: [...] }
Side effects: Same as portfolio-queue
Auth/gating: ENABLE_PROMPT_PACK_API + ENABLE_COMFY_API required
Error cases: 404 (actor candidate not found), 422 (no characterId in notes)
```

---

### ComfyUI integration

```
GET  /api/comfy-status
Purpose: Check if ComfyUI is reachable.
Response: { ok: true, comfy: { available: boolean, baseUrl: string } }
Auth/gating: ENABLE_COMFY_API required; cloud mode returns available=false
```

```
GET  /api/comfy-workflows
Purpose: List all available ComfyUI workflows.
Response: { workflows: [...] }
Auth/gating: ENABLE_COMFY_API required
```

```
POST  /api/comfy-validate-workflow
Purpose: Validate that a specific workflow is usable.
Request body: { workflowId: string }
Response: validation result
Auth/gating: ENABLE_COMFY_API required
```

```
POST  /api/comfy-queue-prompt-pack
Purpose: Queue a single prompt pack to ComfyUI by its ID.
Request body: { promptPackId, seed, workflowId, allowWorkflowFallback, dimensions, dryRun }
Response: { ok: true, promptId, ... }
Auth/gating: ENABLE_COMFY_API required; cloud mode blocks
```

```
POST  /api/comfy-queue-character
Purpose: Queue all views for a character directly (lower-level than portfolio-queue).
Request body: { characterId, views: string[], options }
Auth/gating: ENABLE_COMFY_API required; cloud mode blocks
```

```
GET  /api/comfy-job-status?id=<promptId>
Purpose: Get status of a single ComfyUI job by prompt ID.
Response: { ok: true, ...rawStatusFromComfy }
Auth/gating: ENABLE_COMFY_API required
Error cases: 400 (missing id)
```

```
POST  /api/comfy-jobs-status
Purpose: Batch status check for multiple ComfyUI jobs.
Request body: { jobs: [{ promptId, promptPackId, view }] }
Response: { ok: true, items: [...], summary: { total, success, failed, running, unknown } }
Auth/gating: ENABLE_COMFY_API required
```

```
GET/POST/PATCH  /api/comfy-jobs
GET  — List active (non-terminal) comfy jobs from DB; query param: jobType
POST — Bulk-upsert jobs to DB; body: { jobs: [...] }
PATCH — Bulk-update job statuses; body: { promptIds: string[], status: string }
Side effects: Reads/writes comfy_jobs table
Auth/gating: None
```

```
POST  /api/comfy-ingest-outputs
Purpose: Fetch completed ComfyUI job output images and create generated_image records.
Request body: { promptId, promptPackId, characterId, viewType, workflowVersion }
Response: { ok: true, created: number, items: generatedImageRecord[] }
Side effects: Creates generated_images rows
Auth/gating: ENABLE_COMFY_API required; cloud mode blocks
Error cases: 400 (missing fields), 404 (prompt pack not found), 502 (ComfyUI error)
```

```
POST  /api/comfy-ingest-many
Purpose: Ingest multiple completed jobs in one call.
Request body: { jobs: [{ promptId, promptPackId, characterId, viewType, workflowVersion }] }
Response: { ok: true, items: [...], summary: { total, success, failed, createdRecords } }
Auth/gating: ENABLE_COMFY_API required; cloud mode blocks
```

---

### Generated images

```
GET  /api/generated-images?characterId=&promptPackId=&viewType=&approved=&limit=
Purpose: List generated image records with optional filters.
Response: { ok: true, items: generatedImageRecord[] }
Auth/gating: ENABLE_GENERATED_IMAGES_API required
```

```
POST  /api/generated-image-approve
Purpose: Mark a generated image as approved.
Request body: { id: string }
Response: { ok: true, item: updatedRecord }
Side effects: Sets approved=true, clears rejectedReason in generated_images
Auth/gating: ENABLE_GENERATED_IMAGES_API required
Error cases: 400 (missing id), 404 (not found)
```

```
POST  /api/generated-image-reject
Purpose: Mark a generated image as rejected.
Request body: { id: string, rejectedReason: string (optional) }
Response: { ok: true, item: updatedRecord }
Side effects: Sets approved=false, stores rejectedReason in generated_images
Auth/gating: ENABLE_GENERATED_IMAGES_API required
Error cases: 400 (missing id), 404 (not found)
```

```
GET  /api/generated-image-view?id=<id>
Purpose: Proxy the actual image bytes from ComfyUI's /view endpoint.
Response: Image bytes (content-type from ComfyUI)
Side effects: None (reads record, proxies from ComfyUI)
Auth/gating: ENABLE_GENERATED_IMAGES_API required
Error cases: 400 (missing id or bad image metadata), 404 (record not found), 502 (ComfyUI error)
```

---

### Vector / Chroma

```
GET  /api/vector-status
Purpose: Report on SQLite, Chroma, and embedding system health.
Response: { sqlite: {...}, chroma: {...}, embeddings: {...}, characters: { total, byEmbeddingStatus } }
Auth/gating: ENABLE_VECTOR_MAINTENANCE_API required; cloud mode returns all-unavailable stub
```

```
POST  /api/vector-index-character
Purpose: Index a single character by ID into Chroma.
Request body: { id: string }
Response: indexing result
Side effects: Embeds character and upserts into Chroma collection; updates embedding_status in characters table
Auth/gating: ENABLE_VECTOR_MAINTENANCE_API required
```

```
POST  /api/vector-reindex-characters
Purpose: Reindex all (or filtered) characters.
Request body: filter params
Side effects: Same as index-character, for multiple records
Auth/gating: ENABLE_VECTOR_MAINTENANCE_API required
```

```
POST  /api/vector-similar-by-character
Purpose: Find characters similar to a given character ID.
Request body: { id: string, limit: number }
Response: similarity results with distances
Auth/gating: ENABLE_VECTOR_MAINTENANCE_API required
```

```
POST  /api/vector-similar-by-text
Purpose: Find characters similar to a freetext description.
Request body: { text: string, limit: number }
Response: similarity results
Auth/gating: ENABLE_VECTOR_MAINTENANCE_API required
```

---

### Character Bank entries

```
GET/POST/PUT/DELETE  /api/character-bank
GET    — List all bank entries (?id= or ?slug= for single lookup)
POST   — Create a new bank entry; body: { slug, name, description, optimizedDescription, ... }
PUT    — Update a bank entry; body: { id, ...patch }
DELETE — Delete a bank entry; ?id=<id>
Side effects: Reads/writes character_bank_entries table
Error cases: 409 (SLUG_COLLISION on create or update)
Auth/gating: None
```

---

### Actor candidates and auditions

```
GET/POST/PUT/DELETE  /api/actor-candidates
Full CRUD on actor_candidates table. Filterable by status, sourceBankEntryId, promptPackId.
Auth/gating: None
```

```
GET/POST/PUT/DELETE  /api/actor-auditions
Full CRUD on actor_auditions table. Filterable by actorCandidateId, bankEntryId, status.
Error cases: 409 (AUDITION_EXISTS — unique constraint on actor_candidate_id + bank_entry_id)
Auth/gating: None
```

---

### Saved prompts

```
GET/POST/DELETE/PATCH  /api/saved-prompts
GET    — List all saved prompts (ordered by created_at DESC)
POST   — Create; body: { id, name, text }
DELETE — Delete; ?id=<id>
PATCH  — Rename; body: { id, name }
Side effects: Reads/writes saved_prompts table
Auth/gating: None
```

---

### Workspace profiles

```
GET/PUT/DELETE  /api/workspace-profiles
GET    — List all profiles (ordered by created_at ASC)
PUT    — Upsert; body: { id, label, state: {} }
DELETE — Delete; ?id=<id>
Side effects: Reads/writes workspace_profiles table
Auth/gating: None
```

---

### Reference image analysis

```
POST  /api/analyze-reference-image
Purpose: Analyze a reference image via LLM to extract character/scene descriptors.
Request body: { image data, engine, provider settings }
Response: analysis result
Auth/gating: None
```

---

### Character optimization

```
POST  /api/optimize-character
Purpose: Rewrite a character description into a Qwen-optimized image prompt fragment via LLM.
Request body: { description: string, engine, provider settings }
Response: { optimized: string, provider, ... }
Auth/gating: None
```

---

### SSE render events

```
GET  /api/render-events
Purpose: Server-Sent Events endpoint. Broadcasts render-update events when ComfyUI jobs complete.
Response: text/event-stream; events: 'render-update' with { promptId, status: 'success'|'failed' }
Side effects: Starts the ComfyUI watcher polling loop (2-second interval) on first client connect
Note: Heartbeat sent every 15 seconds. Watcher polls ComfyUI /history?max_items=40.
Auth/gating: None (GET only)
```

---

### Chroma health

```
GET  /api/chroma-health
Purpose: Check if Chroma is reachable.
Response: { available: boolean, url: string }
Auth/gating: None
```

---

## SECTION 4 — Prompt Builder Tab

### 4.1 State variables in App.jsx

All state relevant to the Prompt Builder:

| Variable | Type | Initial value | Controls | Persisted |
|---|---|---|---|---|
| `activeTab` | string | `'builder'` | Which tab is shown | No |
| `scene` | string | `''` | Freetext scene/environment input | No (workspace profile) |
| `selectedDir` | string\|null | `null` | Active director key | No (workspace profile) |
| `charCount` | number | `1` | Number of characters (1–3) | No (workspace profile) |
| `chars` | array | `DEFAULT_CHARS` (3 entries: man/40s, woman/30s, man/20s) | Character slot descriptors. Each entry is `{ g, a }` (anonymous) or `{ g, a, bankCharId, bankCharName, bankCharDesc }` when linked to an Actor Bank character. `bankCharDesc` replaces `getCharDesc(g, a)` in scenario templates when set. | No (workspace profile) |
| `scenario` | string\|null | `null` | Selected director scenario text | No (workspace profile) |
| `chips` | object | `{}` | Active chip selections by group | No (workspace profile) |
| `lastAppliedPresetLabel` | string\|null | `null` | Label of last applied preset | No |
| `blendEnabled` | boolean | `false` | Director blend mode on/off | No (workspace profile) |
| `blendDir` | string\|null | `null` | Secondary director for blend | No (workspace profile) |
| `blendWeight` | number | `70` | Primary director weight (50–90) | No (workspace profile) |
| `customPresets` | object | from localStorage | User-saved chip presets | `CUSTOM_PRESETS_KEY = 'qpb_custom_presets_v1'` |
| `customDirectors` | array | from localStorage | User-created directors (max 3) | `CUSTOM_DIRECTORS_KEY = 'qpb_custom_directors_v1'` |
| `profiles` | object | from DB (migrated from localStorage) | Named workspace snapshots | SQLite `workspace_profiles` table |
| `selectedProfile` | string | `''` | Current active profile key | No |
| `paletteOpen` | boolean | `false` | Command palette visibility | No |
| `narrativeBeat` | string\|null | `null` | Narrative/ideation seed for polish | No (workspace profile) |
| `useStyleKeyForPolish` | boolean | `false` | Use styleKey instead of director note | No (workspace profile) |
| `applyDiff` | object\|null | `null` | Recent-changes diff display | No |
| `isApplyDiffPinned` | boolean | `false` | Pin diff display | No |
| `pendingApply` | object\|null | `null` | Pre-apply state snapshot | No |
| `aiEngine` | string | from localStorage | AI provider for polish | `AI_ENGINE_KEY = 'qpb_ai_engine_v1'` |
| `localOnly` | boolean | from localStorage | Block cloud fallback | `LOCAL_ONLY_KEY = 'qpb_local_only_v1'` |
| `embeddedSetupOpen` | boolean | `false` | Embedded sidecar setup panel | No |
| `embeddedStatus` | object\|null | `null` | Embedded sidecar connection state | No |
| `characters` | object | from localStorage | Character Builder slug→entry map | `CHARACTERS_KEY = 'qpb_characters_v1'` |
| `bankCharsForSelector` | array | `[]` (fetched on mount) | Actor Bank characters for slot linking and `@slug` expansion. Each entry: `{ id, name, desc, slug, optimizedDescription }`. Fetched via `GET /api/characters?sortBy=name` on mount. | No |
| `bankCharDict` | object | derived from `bankCharsForSelector` | Slugified Actor Bank chars in characters-dict shape — used in `effectiveCharacters`. `{ [slug]: { name, rawDescription, optimizedDescription } }` | No (derived) |
| `effectiveCharacters` | object | derived | `{ ...bankCharDict, ...characters }` — passed to `assemblePrompt` as the `characters` argument. localStorage entries win on slug collision. | No (derived) |

**Inside PromptOutput.jsx (local state):**

| Variable | Type | Initial | Controls | Persisted |
|---|---|---|---|---|
| `selectedVariant` | object\|null | `null` | Active variant override | No |
| `restoredText` | string\|null | `null` | Restored-from-history override | No |
| `manualEdit` | string\|null | `null` | In-textarea manual edit | No |
| `history` | array | from localStorage | Prompt history (max 12) | `HISTORY_KEY = 'qpb_prompt_history_v1'` |
| `savedPrompts` | array | from DB | Named saved prompts | SQLite `saved_prompts` table |
| `localProvider` | string | from localStorage | Local LLM provider | `LOCAL_PROVIDER_KEY = 'qpb_local_provider_v1'` |
| `lmStudioHost` | string | from localStorage | LM Studio host | `LMSTUDIO_HOST_KEY = 'qpb_lmstudio_host_v1'` |
| `lmStudioPort` | string | from localStorage | LM Studio port | `LMSTUDIO_PORT_KEY = 'qpb_lmstudio_port_v1'` |
| `lmStudioModel` | string | from localStorage | LM Studio model | `LMSTUDIO_MODEL_KEY = 'qpb_lmstudio_model_v1'` |

---

### 4.2 Assembly Pipeline

**`rewriteScene(raw, characters)`** — `src/utils/assembler.js`

1. Expands `@slug` tokens: replaces any `@word` with the matching character's `optimizedDescription` or `rawDescription` from the characters object. The `characters` argument is `effectiveCharacters` (Actor Bank chars merged with Character Builder localStorage entries), so both `@actor_bank_slug` and `@character_builder_slug` tokens resolve.
2. Trims trailing period.
3. Applies 29 REWRITES entries (regex replacements). Each replaces a common shorthand with a more material, specific phrase.

Representative REWRITES examples (total: 29 entries):
- `eastern european village` → `eastern European village outskirts, low rendered-brick houses, corrugated metal fences, overgrown garden plots`
- `\bforest\b` → `stand of bare deciduous trees, pale trunks`
- `\bfield\b` → `field of dead grass and flat earth`
- `\bstanding\b` → `standing still, weight on one foot, not at attention`
- `gray raincoat` → `gray wool raincoat, collar turned up, dark with moisture at the shoulders`

**`assemblePrompt({ scene, scenario, chips, characters })`** — `src/utils/assembler.js`

`characters` is `effectiveCharacters` from App.jsx (Actor Bank chars + Character Builder localStorage, merged at call site).

Priority order (fragments are pushed in this sequence):

1. **Shot chip** (`chips.shot[0]`) — if no shot chip but content exists, uses `DEFAULTS.shot = 'wide establishing shot'`
2. **Lens chips** (`chips.lens[]`) — if no lens chips but content exists, uses `DEFAULTS.lens = '35mm natural lens'`
3. **Scenario** — the selected director scenario string (if set)
4. **Rewritten scene** — the `rewriteScene()` output (if non-empty)
5. **Environment chips** (`chips.env[]`)
6. **Texture chips** (`chips.texture[]`)
7. **Composition chips** (`chips.comp[]`)
8. **Light chips** (`chips.light[]`) — if none and content exists, uses `DEFAULTS.light = 'flat overcast light, uniform gray sky, no cast shadows'`
9. **Color chips** (`chips.color[]`) — if none and content exists, uses `DEFAULTS.color = 'muted desaturated palette, faded olive and slate gray'`
10. **Film chips** (`chips.film[]`) — if none and content exists, uses `DEFAULTS.film = 'shot on 35mm film, grain visible in flat areas'`
11. **Qualifier chips** (`chips.qual[]`) — if none and content exists, uses `DEFAULTS.qual = 'photorealistic, not CGI, not illustrated'`

Final result is passed through `dedupeFragments()`.

**`dedupeFragments(parts)`** — implements three checks (via `isNearDuplicate`):

1. **Exact normalized match**: `normalizeFragment(a) === normalizeFragment(b)` — catches exact text duplicates after lowercasing and stripping punctuation.
   - *Example caught*: `'35mm film'` vs `'35mm film'` → drops second.

2. **Substring containment (fast path)**: if the shorter normalized string has length ≥ 24 characters and the longer string contains it, treat as duplicate.
   - *Example caught*: `'flat overcast light, uniform gray sky'` appearing as a substring of a longer combined chip string.

3. **Token-based overlap**: computes Jaccard similarity (intersection / union of token sets) AND overlap-to-smaller ratio (intersection / min(|A|, |B|)). Flags duplicate if `jaccard >= 0.9` OR `overlapToSmaller >= 0.8`.
   - *Example caught*: `'shot on 35mm film, grain visible in flat areas'` vs `'35mm film grain visible'` — high overlap-to-smaller would catch this.

---

### 4.3 Director System

**Exact director count: 61** (verified by counting top-level object keys in `src/data/directors.js`).

**Director object schema:**

```js
{
  name: string,       // full name e.g. "Andrei Tarkovsky"
  short: string,      // abbreviated e.g. "Tarkovsky"
  note: string,       // one-line aesthetic register description
  s: {
    1: (c: string[]) => string[],   // scenarios for 1 character
    2: (c: string[]) => string[],   // scenarios for 2 characters
    3: (c: string[]) => string[],   // scenarios for 3 characters
  }
}
```

**Scenario structure:** Each scenario is a function that takes `c` (an array of character descriptor strings) and returns an array of scenario strings. The `c[]` values are resolved in `DirectorSection.jsx`:

```js
charDescs[i] = chars[i]?.bankCharDesc ?? getCharDesc(chars[i]?.g, chars[i]?.a)
```

- When a character slot is linked to an Actor Bank character, `bankCharDesc` (e.g. `"Aria Chen, femme fatale"`) is used instead of the anonymous demographic string.
- When unlinked, `getCharDesc(gender, age)` produces strings like `"young woman in her mid-twenties"` (for gender='woman', age='20s').
- Full descriptor map covers genders: `man`, `woman`, `person` × ages: `child`, `teen`, `20s`, `30s`, `40s`, `50s`, `60s`, `elderly`
- Fallback for unknown combination: `"${gender}, ${age}"`

**`bankCharDesc` construction** (`buildBankCharDesc` in `App.jsx`): `"{name}, {cinematicArchetype}"` if archetype is set; otherwise `"{name}, {age}yo {genderPresentation}"` if demographics available; otherwise just `"{name}"`.

**DIRECTOR_PRESETS:** Defined separately in `src/data/constants.js`, keyed by the same director key (e.g. `tarkovsky`). They contain chip presets (shot, lens, env, texture, light, color, film, qual). They are entirely separate data structures from the scenario data in `directors.js`. Both can be used independently: a user can apply a director's chip preset without selecting a scenario, and can select a scenario without applying the chip preset.

There are also 6 `FEATURED_PRESETS` (tarkovsky, kubrick, mann, jarmusch, winter, noir) in `FEATURED_PRESETS_RAW` that are simpler chip-only presets without director authorship, merged into the exported `PRESETS` object.

---

### 4.4 Director Blending

The `blendPresetChips(primaryKey, secondaryKey, primaryWeight)` function in `App.jsx`:

1. Loads `primary = DIRECTOR_PRESETS[primaryKey].chips` and `secondary = DIRECTOR_PRESETS[secondaryKey].chips`.
2. `dominantPrimary = (primaryWeight >= 50)` — determines which director is dominant.
3. For each chip group (`allGroups = union of primary and secondary keys`):
   - `dominant` = primary chips if `dominantPrimary`, else secondary chips.
   - `secondaryVals` = the other director's chips.
   - Starts `values = [...dominant]`.
   - **Single-source dimensions** (`light`, `shot`, `film`): never merges secondary chips — uses dominant only.
   - **All other dimensions**: if `secondaryVals[0]` exists and is not already in `values`, appends it.
4. The blend result therefore **can** produce multiple chips in the same non-single-source dimension (e.g., two `env` chips, two `lens` chips, two `color` chips, two `qual` chips).
5. `light`, `shot`, and `film` will always have exactly the dominant director's chips — never a mix.

**Weight slider effect:** The slider (range 50–90) affects only which director is "dominant". At `blendWeight = 70`, primary is dominant (70 ≥ 50). The weight does not affect how many chips from each director are included beyond dominant vs secondary selection.

**Same-dimension conflicts after blend:** Validation rules still run. If two `light` chips appear (they won't, given single-source protection), the validation rule `multiple-light` would fire. Two `color` chips from opposing palettes could trigger `conflict-palette-saturation`. The validation system remains active during blending — it does not know or care that a blend was applied.

**Label when blend is active:** Set to `"${primary.short} ${weight}/${100-weight} ${secondary.short}"` (e.g. `"Tarkovsky 70/30 Kubrick"`).

---

### 4.5 Scene Matcher

`src/components/SceneMatcher.jsx` — accessible as a collapsible section in the Prompt Builder tab.

**What it does:** Searches a local corpus of director scenarios and "scene cards" and returns matches. The user types free keywords; results appear after a 120ms debounce. Pressing Enter or clicking a result applies it to the current workspace.

**Access:** A collapse/expand section in the Prompt Builder. Can also be focused programmatically from the command palette ("Focus scene match").

**Input:** A plain text query string (e.g., `"neon rain longing"`, `"kubrick corridor"`). Built-in example queries shown for guidance.

**Results structure:**
- **Directors**: director-level matches (dirKey + metadata)
- **Seeds**: director-specific scenario seeds (seedText, dirKey, styleKey)
- **Cards**: environment/scene cards (cardText, chipPatch)

**What it outputs / changes on apply:**
- `applySeed`: sets `scene` (appends), sets `dirKey` (selects director, clears scenario, useStyleKeyForPolish=false), applies `DIRECTOR_PRESETS[dirKey]` chips, sets `narrativeBeat` to `"Style key: ${styleKey}. Seed: ${seedText}"`.
- `applyDirector`: sets dirKey, applies director preset chips.
- `applyCard`: sets `scene` (appends), applies `chipPatch` if present.

**Algorithm:** Uses `searchCorpus()` from `src/utils/sceneSearch.js` — this is a local (no API call) text-matching function against a compiled search corpus built from director scenarios and scene cards.

---

### 4.6 Display Priority

The display text in `PromptOutput.jsx` follows this exact priority chain (from the code):

```js
const displayText = manualEdit !== null
  ? manualEdit
  : restoredText
  ? restoredText
  : hasVariantOverride
  ? selectedVariant.text
  : isPolished
    ? polished
    : assembledText
```

**Priority (highest to lowest):** `manualEdit` > `restoredText` > `selectedVariant` > `polished` > `assembledText`

**`handlePolish()` behavior:**
```js
const handlePolish = () => {
  setRestoredText(null)
  setManualEdit(null)
  setSelectedVariant(null)
  polish({ ... })
}
```
Yes — `handlePolish()` clears `restoredText`, `manualEdit`, AND `selectedVariant` before starting the polish request. The polish result will therefore display once returned.

**What happens to manualEdit when a chip changes:** `manualEdit` is NOT cleared by chip changes. It persists until the user explicitly resets to assembled (`handleResetToAssembled`) or starts a new polish run.

**What happens to selectedVariant when chips change:**
```js
// Clear selected variant when assembled prompt changes so stale variant text is never shown.
useEffect(() => { setSelectedVariant(null) }, [assembledText])
```
`selectedVariant` IS cleared whenever `assembledText` changes, which happens whenever chips, scene, scenario, or characters change.

---

### 4.7 Quality Score

`src/utils/qualityScore.js` — six components, max total 100.

| Component | Key | Max | Signal |
|---|---|---|---|
| Prompt density | `length` | 25 | Word count of display text: ≥55w=25, ≥35w=20, ≥20w=14, ≥10w=8, >0w=4, 0=0 |
| Subject + scene | `context` | 15 | Scenario selected (+10), scene non-empty (+5) |
| Anti-CGI anchors | `anti` | 20 | Regex `/not cgi\|photorealistic\|analog\|film grain\|imperfect\|non-idealized\|documentary register\|real worn/i` present in text: 20, else 0 |
| Film stock language | `film` | 15 | Regex `/kodak\|fuji\|35mm\|16mm\|tri-x\|vision3\|eterna\|film halation\|grain/i` present: 15, else 0 |
| Light (single source) | `light` | 15 | 1 light chip = 15; 0 light chips but light regex in text = 10; >1 light chip = 4; else 6 |
| Material specificity | `material` | 10 | Regex `/concrete\|rust\|mud\|plaster\|water\|fog\|rain\|texture\|worn\|aggregate\|brick\|steel\|glass\|wet/i` present: 10, else 4 |

The scoring is performed on `displayText` (whatever is currently showing), not just the assembled text. Director selection does not directly affect scoring — the score responds to the content of the assembled/displayed text.

---

### 4.8 Validation Rules

`src/utils/promptRules.js` — `validatePromptRules({ chips, hasContent, maxLens })` returns an array of issues.

| Rule ID | Severity | Detects | Auto-fix action |
|---|---|---|---|
| `multiple-light` | high | More than one `chips.light` chip | Keeps `chips.light[0]`, removes rest |
| `color-conflict` | medium | Two `chips.color` chips from opposing COLOR_FAMILY_RULES pairs (3 pairs defined) | Keeps `chips.color[0]` |
| `lens-overflow` | low | `chips.lens.length > maxLens` (default maxLens=2) | Trims to first 2 lens chips |
| `film-overflow` | high | More than one `chips.film` chip | Keeps `chips.film[0]` |
| `missing-anti-cgi` | medium | `hasContent` is true AND no anti-CGI qualifier in `chips.qual` | Adds `'photorealistic, not CGI, not illustrated'` to `chips.qual` |
| `conflict-location-multi` | high | Multiple distinct `locationType` tags in any chips | keep-first-by-tag strategy for `locationType` |
| `conflict-setting-domain` | high | Both `interior` and `exterior` `settingDomain` tags present | keep-first-by-tag strategy for `settingDomain` |
| `conflict-palette-saturation` | medium | Both `low` and `high` `saturation` tags present | keep-first-by-tag strategy for `paletteFamily` |
| `conflict-realism-mode` | medium | Both `photoreal` and `surreal` `realismMode` tags present | prefer-tag-value: keeps `photoreal` |
| `conflict-film-saturation` | high | Both `high` and `low` `filmSaturation` tags present | keep-first-by-tag strategy for `filmStock` |
| `conflict-film-contrast` | medium | Both `high` and `low` `filmContrast` tags present | keep-first-by-tag strategy for `filmStock` |
| `conflict-light-source-multi` | high | Multiple distinct `lightSourceKind` tags across chips | keep-first-by-tag strategy for `lightSourceKind` |

COLOR_FAMILY_RULES (conflicting pairs):
- `'night-city cyan and orange, neon palette'` vs `'drained earth tones, brown and pale beige, very low saturation'`
- `'deep saturated jewel tones, intentional color architecture'` vs `'near-monochrome, color barely present'`
- `'black and white, crushed shadows, bright overcast sky'` vs `'bold primary color accent against neutral ground, theatrical'`

---

### 4.9 Variants

`src/utils/variants.js` — `generatePromptVariants(parts)`:

Three variants are generated from the assembled `parts` array:

1. **Composition focus** (`id: 'composition'`): appends `', figures at left third of frame, large negative space right'` + ensures anti-CGI anchors
2. **Texture + light focus** (`id: 'texture-light'`): appends `', rain-soaked surfaces, reflections of sky in wet ground, single practical lamp, warm pool in dark room'` + ensures anti-CGI anchors
3. **Color + film focus** (`id: 'color-film'`): appends `', cool blue-gray, low contrast midtones, Kodak Vision3 5219, rich shadows, neutral highlights'` + ensures anti-CGI anchors

`ensureAnchors()` adds `', photorealistic, analog photography, not CGI, not illustrated'` only if BOTH `'not cgi'` AND `'analog photography'` are already absent.

**Variant selection on chip change:** `selectedVariant` is cleared whenever `assembledText` changes (i.e., whenever chips/scene/scenario/characters change). Any selected variant becomes stale and is reset.

**Variant selection on Polish:** `handlePolish()` explicitly calls `setSelectedVariant(null)` before the polish request, so the polish result will display rather than the variant.

---

### 4.10 Polish System

**Provider resolution chain** (from `resolveProviderSelection()` in `polishCore.js`):

1. Normalize engine: `'auto'`, `'local'`, `'cloud'`, or `'embedded'` (any other value → `'auto'`)
2. If `engine='embedded'`: probe embedded sidecar; if unavailable → 503
3. If `engine='auto'` and embedded sidecar is available → use embedded
4. If `engine='local'` or (`engine='auto'` and default is local): probe local provider (ollama/lmstudio/mock); if available → use local; if unavailable and `localOnly=true` → 503; else fallback to cloud
5. If `engine='cloud'` or fallback: use Claude (Anthropic) by default, or mock if `cloudProvider='mock'`

**System prompt key instructions** (full text in `api/lib/polishCore.js`):
- Output ONLY the final prompt — no preamble, markdown, quotes, or explanation
- Single block of comma-separated descriptive phrases
- Length: 60–110 words exactly
- No abstract mood words ("moody", "atmospheric", "melancholic", "cinematic" as standalone)
- No action description — static composition only
- Figures must be passive (absorbed, waiting, unaware)
- One light source only — if conflicts, choose most cinematically specific
- No idealization ("beautiful", "stunning", "perfect")
- Environment must feel larger and more present than human subject
- End with anti-CGI anchors
- Translate narrative beats into one frozen instant; preserve only spatial/physical truth

**`buildUserMessage()` — director injection:** Yes, `directorNote` is injected. The function constructs:
```
Director register: ${directorName} - ${directorNote}
```
(or `"No specific director selected — apply general cinematic principles."` if no director).

**"All other directors" fallback:** Yes, confirmed. The system prompt explicitly states:
```
- For directors not listed above, apply the general aesthetic signature
  provided by the user.
```
This is the last bullet in the DIRECTOR REGISTER section, after 16 named directors.

**Embedded provider:** Calls `http://127.0.0.1:${port}/v1/chat/completions` with the `x-qpb-sidecar-secret` header. Default model: `qwen2.5-3b-instruct-q4_k_m`. Temperature: 0.35. Max tokens: 220. Timeout: `EMBEDDED_TIMEOUT_MS` (default 180,000ms / 3 min).

---

### 4.11 Persistence

| State | Storage | Key / Location | Notes |
|---|---|---|---|
| Custom presets | localStorage | `qpb_custom_presets_v1` | Object of { label, chips } |
| Custom directors | localStorage | `qpb_custom_directors_v1` | Array, max 3 |
| AI engine | localStorage | `qpb_ai_engine_v1` | `'auto'|'local'|'cloud'|'embedded'` |
| Local-only flag | localStorage | `qpb_local_only_v1` | `'1'` or `'0'` |
| Characters (bank) | localStorage | `qpb_characters_v1` | Slug→entry map; mirrored to/from DB |
| Workspace profiles | SQLite + localStorage migration | `workspace_profiles` table | One-time migration from `qpb_workspace_profiles_v1` |
| Saved prompts | SQLite + localStorage migration | `saved_prompts` table | One-time migration from `qpb_saved_prompts_v1` |
| Prompt history | localStorage | `qpb_prompt_history_v1` | Array, max **12** entries (HISTORY_LIMIT=12) |
| Local provider | localStorage | `qpb_local_provider_v1` | `'ollama'|'lmstudio'|'mock'` |
| LM Studio host/port/model | localStorage | `qpb_lmstudio_host_v1`, `_port_`, `_model_` | |

**Saved prompts cap:** No cap is enforced in the code. The `createSavedPrompt` repository function has no COUNT check before insertion. There is no enforced limit of 30 — any limit previously documented was not found in the current codebase.

**Prompt history cap:** Exactly **12** entries (`HISTORY_LIMIT = 12` in `PromptOutput.jsx`). When a new entry is added: dedup by text, prepend, then `slice(0, HISTORY_LIMIT)`.

**Share URL:** The state is base64-encoded as a JSON object in the URL hash (`#state=...`). Contains: `scene`, `dirKey`, `charCount`, `chars`, `scenario`, `chips`, `blendEnabled`, `blendDir`, `blendWeight`, `narrativeBeat`, `useStyleKeyForPolish`, `aiEngine`, `localOnly`.

---

## SECTION 5 — Character Builder Tab

### What a "character bank entry" is

A character bank entry is a named, reusable character description stored in the `character_bank_entries` SQLite table and mirrored into `localStorage['qpb_characters_v1']`. It is distinct from a generated character record in the `characters` table. Bank entries are the *input specification* for a character (who they are), while `characters` records are *output instances* (LLM-generated profiles with full attributes, ready for rendering).

### Character bank entry form fields

From the `CharacterBuilder.jsx` state:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | Display name (e.g., "Elena") |
| `slug` | string | Derived | Auto-generated from name via `toSnakeSlug(name)` (snake_case). Can be overridden manually via `slugDraft`. |
| `description` | string | Yes (or `acceptedText`) | Freetext character description — the raw input |
| `acceptedText` | string | No | The accepted/optimized description (can be LLM-rewritten) |

### Validation

- `canSave = Boolean(slug && name.trim() && (acceptedText.trim() || description.trim()))`
- If `slugDraft` is manually set and a different character already occupies that slug (`isDuplicate`), save is blocked.
- Slug collision with an existing bank entry (`SQLITE_CONSTRAINT_UNIQUE`) is surfaced as `'Slug already in bank under a different character'`.

### Save behavior

1. `finalSlug` is computed: if `slugDraft` was manually set, use it literally; if auto-derived from name and would collide with an existing entry for a *different* character, auto-suffix is applied via `withUniqueSuffix()`.
2. Character is saved to `localStorage['qpb_characters_v1']` immediately.
3. `syncCharacter(value)` is called in the background — attempts to create or update the entry in `character_bank_entries` via `/api/character-bank`. Failures are silent; localStorage remains the fallback.
4. Sync status per slug is tracked (`bankSyncStatus`): `'idle'` → `'syncing'` → `'synced'` or `'error'`.

### The `@snake_case` slug

- Generated by `toSnakeSlug(name)` from `src/utils/slugify.js`.
- Used to reference a character in the scene input via `@slug_name` token.
- `rewriteScene()` in `assembler.js` expands these tokens by looking up the slug in the `characters` object and substituting the `optimizedDescription` (if available) or `rawDescription`.

### Optimized description (LLM rewrite)

- **Optional.** The user can call `optimize()` (from `useCharacterOptimize` hook, which calls `/api/optimize-character`) to generate an LLM-rewritten version of `description`.
- The optimized text is shown in a preview area. The user can accept it (sets `acceptedText`) or discard it.
- If `acceptedText` is empty at save time, `rawDescription` is used as both `description` and `optimizedDescription` will be null/empty.
- Save writes verbatim: `rawDescription = description.trim()`, `optimizedDescription = (acceptedText || optimized || '').trim()`.

### Listing/management

- Entries are listed ordered by `createdAt` (descending) in a sidebar.
- Clicking an entry loads it into the form fields (`loadCharacter`).
- Deleting removes from localStorage only (`removeCharacter`); the DB entry is NOT deleted in the current code.
- No reordering capability exists.

### Relationship to Path A in Casting Room

Path A (`/api/audition/generate`) reads `bankEntryId` from the request. `runAudition()` calls `getBankEntry(db, bankEntryId)` to get the bank entry, then calls `buildBankEntryAuditionPrompt({ bankEntry, count })` to construct the LLM prompt. The LLM receives the `description` field (raw description) and the `optimizedDescription` if present — both are available on the `bankEntry` object. The specific prompt template in `api/lib/audition/auditionPrompts.js` determines which fields are used; this file was not read in full, but the orchestrator passes the full `bankEntry` object to it.

---

## SECTION 6 — Casting Room Tab

The entire Casting Room is implemented in `src/components/CastingPipelinePanel.jsx`.

### 6.1 Path A — Cast from Bank (Audition)

**`handleGenerateAudition()` call chain:**

1. Validates `selectedBankEntryId` is set.
2. Resets `ingestedRef.current = new Set()`.
3. Calls `generateAudition({ bankEntryId, count, workflowId })` → `POST /api/audition/generate`.
4. Server: `runAudition()` in `auditionOrchestrator.js`:
   a. Looks up bank entry from DB.
   b. Calls LLM with `buildBankEntryAuditionPrompt({ bankEntry, count })` to generate `count` character profiles as JSON.
   c. For each profile:
      - Creates `characters` DB row (`lifecycleStatus='auditioned'`, `embeddingStatus='not_indexed'`) via `createCharacter()`.
      - For each requested view:
        - Compiles a prompt pack via `compileCharacterPromptPacks({ db, input: { characterId, views: [view] } })` → creates `prompt_packs` row.
        - If `comfyService` is available, queues the prompt pack to ComfyUI via `service.queuePromptPackById()`.
        - Creates an `actor_candidate` record and an `actor_audition` record (status='pending') in DB.
5. On response, frontend:
   - Stores results in `auditionResults`.
   - Sets initial statuses for all ComfyUI prompt IDs → `setAuditionStatuses`.
   - Calls `startAuditPoll()` to begin polling.
   - Saves job records to `comfy_jobs` table via `saveComfyJobs()`.
   - Refreshes `savedCharacters` list; **auto-selects the first successfully generated character** via background prompt pack compilation (`backgroundCompilePromptPacks`).

**Auto-selection:** Auto-selection fires on *generation* (not approval). After `handleGenerateAudition()` succeeds and the character list is refreshed, all new character IDs trigger `backgroundCompilePromptPacks`. There is no explicit "select first character" call visible in the code after generation — the character just appears in the dropdown and the user selects manually unless the Active Character section auto-scrolls.

**"Approve + Portfolio" (`handleApproveAndQueuePortfolio`):**
1. Calls `approveActorAudition(auditionId)` → `PUT /api/actor-auditions`.
2. Sets `selectedCharacterId = characterId`.
3. Scrolls Active Character section into view.
4. If no `selectedWorkflowId` → shows `postApprovalPrompt` dialog instead of queuing.
5. Otherwise: calls `queueCharacterPortfolio({ characterId, views, workflowId, options })` → `POST /api/character-portfolio-queue`.
6. `views` = selected portfolio view list; if none selected, defaults to all enabled views.
7. Saves ComfyUI jobs to DB, starts portfolio poll.
8. Sets `lifecycleStatus = 'portfolio_pending'` via `patchCharacterLifecycle`.

**"Pass" / Reject audition (`handleRejectAudition`):**
1. Prompts user for optional reason.
2. Calls `rejectActorAudition(auditionId, reason)` → `PUT /api/actor-auditions` with `status='rejected'`, `rejectedReason`.

**"More Takes" (`handleMoreTakes`):**
1. No explicit gate condition checked in code before calling — the UI button is shown per-character; the user selects views and clicks "Queue Takes".
2. Calls `queueMoreTakes({ characterId, views })` → `POST /api/actor-more-takes`.
3. Tracks jobs per character in `moreTakesState[characterId]`.

---

### 6.2 Path B — Batch Pipeline

**`handleGenerateBatch()` (via "Generate Batch" button):**
1. Calls `generateBatch({ request: { ageMin, ageMax, count, gender, projectTone }, options: { persistBatch: true, checkSimilarity: true }, provider: {} })` → `POST /api/characters-generate-batch`.
2. Server: `runBatchCharacterGeneration()`:
   a. Calls LLM to generate `count × candidateMultiplier` character profiles.
   b. For each candidate, computes embedding and queries Chroma for similar characters.
   c. Classifies each candidate:
      - Distance ≤ 0.18 → `'rejected'` (hard reject — too similar to existing)
      - Distance ≤ 0.28 → `'needsMutation'` (borderline — needs modification)
      - Distance > 0.28 → `'accepted'`
   d. If `persistBatch=true`: calls `persistBatchFromGeneration()` → creates `character_batches` row and `character_batch_candidates` rows.

**Similarity classification thresholds (from `batchGeneration.js`):**
- `hardRejectDistance = 0.18` → classified `'rejected'`
- `needsMutationDistance = 0.28` → classified `'needsMutation'`
- Above `0.28` → classified `'accepted'`

**"Generate Previews" (`handleGeneratePreviews`):**
- Targets candidates with `reviewStatus === 'approved'` that have no existing `batchPreviewJobs` entry.
- For each: calls `generateCandidatePreview(candidate.id, workflowId)` → `POST /api/batch-candidate-preview`.
- Server creates a **temporary** `characters` record (`lifecycleStatus='preview'`), compiles a `front_portrait` prompt pack, queues to ComfyUI.
- On render completion (via poll/SSE), the image URL is saved to `candidate.previewImageUrl` via `/api/batch-candidate-preview-image`, and the temporary character is deleted via `deleteTempCharacter`.
- The temporary character creation is a **current behavior** — path B previews DO create character records as a side effect, but they are temp records that are cleaned up after image ingest. This is what C2 was tracking.

**"Shortlist" → approve (`handleCandidateAction('approve', id)`):**
- Calls `approveBatchCandidate(id)` → `POST /api/character-batch-candidate-approve`.
- Sets `reviewStatus='approved'`, `classification='accepted'`.
- Recalculates batch summary.

**"Dismiss" → reject:**
- Calls `rejectBatchCandidate(id, reason)` → `POST /api/character-batch-candidate-reject`.
- Sets `reviewStatus='rejected'`, `classification='rejected'`, stores reason.

**"Reconsider":**
- Calls `reconsiderBatchCandidate(id)` → `POST /api/character-batch-candidate-reconsider`.
- Sets `reviewStatus='pending'`, `classification='accepted'`, clears reviewNote.

**"Save to Cast" (`handleCandidateAction('save', id)`):**
1. Calls `saveBatchCandidate(id)` → `POST /api/character-batch-candidate-save`.
2. Server (`saveCandidateAsCharacter` in `batchReview.js`):
   a. If `!force` and vector store available: runs similarity check against existing characters (threshold 0.28).
   b. If similar character found: returns `{ warning: 'similar_character_found', matches }` → frontend shows confirm dialog.
   c. User can force-save by confirming → calls again with `{ force: true }`.
   d. Calls `saveApprovedCandidateAsCharacter(db, id)` → creates `characters` row (`lifecycleStatus='auditioned'`, `embeddingStatus='not_indexed'`), updates candidate `savedCharacterId` and `reviewStatus='saved'`.
   e. Triggers async vector reindex via `triggerReindex()`.
3. Frontend: adds new character to `savedCharacters`, selects it, scrolls Active Character into view, calls `backgroundCompilePromptPacks(newId)`.
4. Similarity re-check at Save to Cast time: **IS implemented** via the `findSimilarCharacters` call in `saveCandidateAsCharacter` in `batchReview.js`. This is C3 — it is done.

**"Project tone" field:** Set as `batchGenTone` in state. Passed as `request.projectTone` in the batch generation request. How it affects the LLM prompt is determined by `buildBatchCandidateGenerationPrompt` in `api/lib/characters/prompts.js` (not read in full). The field is included in the `request` object sent to the LLM system.

---

### 6.3 Active Character Section

**Lifecycle status state machine:**

| Status | Meaning | What triggers it |
|---|---|---|
| `'auditioned'` | Character has been generated but no portfolio render initiated | Default on creation (both paths); set by `setAuditioned()` |
| `'preview'` | Temporary state for batch preview render characters | `POST /api/batch-candidate-preview` creates characters with this status |
| `'portfolio_pending'` | Portfolio render has been queued to ComfyUI | Set by `patchCharacterLifecycle(id, 'portfolio_pending')` when portfolio queue succeeds |
| `'portfolio_failed'` | All portfolio jobs failed (none succeeded) | Set automatically when `allFailed=true` after portfolio polling completes |
| `'ready'` | At least one image has been approved | Set by `patchCharacterLifecycle(id, 'ready')` when `handleGeneratedImageReview('approve', id)` is called |
| *(archived)* | Soft-archived via `archived_at` column, not a lifecycle_status value | Set by `archiveCharacter()` |

**Transitions:**
- Any → `'portfolio_pending'`: clicking "Approve + Portfolio" or "Queue Portfolio" button
- `'portfolio_pending'` → `'portfolio_failed'`: portfolio poll completes with all jobs failed
- Any → `'ready'`: first image approval in gallery
- Any → `'auditioned'`: explicit call to `/api/character-lifecycle` with `lifecycleStatus='auditioned'`
- `'auditioned'` → `'preview'`: batch preview render creation

**Prompt pack compilation:**
- Triggered automatically (background) when a character is selected after audition or save.
- Also triggered manually via "Compile Prompt Packs" button.
- Background compilation via `backgroundCompilePromptPacks(characterId)` calls `POST /api/prompt-pack-compile-character`.
- Prompt packs are loaded automatically when `selectedCharacterId` changes (via `useEffect`).
- Default selection: first item in `listed.items` after compilation.
- The "sort by most recent per view angle" feature (L3) is referenced in commit history; actual selector behavior defaults packs sorted by `created_at DESC`.

**Portfolio queue:**
1. User selects views (checkboxes, default on: front_portrait, three_quarter_portrait, profile_portrait, full_body, audition_still; default off: cinematic_scene).
2. User selects workflow from dropdown.
3. Clicks "Queue Portfolio" → `handleQueuePortfolio()`.
4. Calls `POST /api/character-portfolio-queue` with selected views.
5. Jobs saved to `comfy_jobs` table.
6. `lifecycleStatus` → `'portfolio_pending'`.
7. Polling starts at 20-second interval; SSE triggers immediate ticks.

**Gallery:**
- Images retrieved via `refreshGallery()` → `listGeneratedImages({ characterId, limit: 100 })`.
- "Approve" → `approveGeneratedImage(id)` → `POST /api/generated-image-approve`; sets `approved=true`; then triggers `patchCharacterLifecycle(id, 'ready')`.
- "Reject" → `rejectGeneratedImage(id, reason)` → `POST /api/generated-image-reject`; sets `approved=false`.

**Conditional copy (Journey A vs B):**
The brief asks about this — specifically whether the "audition images present" condition determines different copy. From code, `postApprovalPrompt` is set when approving an audition character but no workflow is selected. The UI text shown is not visible in the portions read. There is no conditional "Journey A vs B" copy found explicitly in the CastingPipelinePanel code read — this may be in JSX UI strings not captured in the above reads.

---

### 6.4 Render System

**SSE endpoint:** Confirmed. `GET /api/render-events` exists and returns `text/event-stream`. `EventSource` is used on the frontend in `CastingPipelinePanel.jsx`:
```js
const source = new EventSource('/api/render-events')
```
SSE is opened only when `isPollingAudit || isPollingPortfolio` is true. Closed when both are false.

**SSE event behavior:** When a `render-update` event arrives, a 250ms debounce timer fires one poll tick (`auditTickRef.current?.()` and `portfolioTickRef.current?.()`).

**Polling interval:** `POLL_MS = 20000` (20 seconds). This is the fallback interval when SSE is not triggering ticks. The value 20000 is NOT shown in any user-facing copy (UI does show "live" vs "polling" in `RenderStatusBar`).

**`ingestedRef`:** Confirmed as a `useRef(new Set())`. Prevents double-ingestion: before calling `ingestComfyOutputsMany`, the poll tick checks `!ingestedRef.current.has(j.promptId)`, and immediately adds `j.promptId` to the Set before making the call.

**Job persistence:** Confirmed as SQLite (`comfy_jobs` table). H3 is implemented. On mount:
```js
const [auditRes, portfolioRes] = await Promise.all([
  listActiveComfyJobs('audition'),
  listActiveComfyJobs('portfolio'),
])
```
If active jobs exist in DB, polling is restored. Audit jobs are stored in `dbRestoredAuditJobsRef.current`.

**RenderStatusBar:** The inline `RenderStatusBar` component in `CastingPipelinePanel.jsx` shows:
- `Rendering · {done}/{total} complete · live` (when SSE connected)
- `Rendering · {done}/{total} complete · polling` (when using polling fallback)
- Segments: `⚡ Audition: done/total`, `Portfolio: done/total`, `More takes: done/total`
- M5 (Live/Polling state display) is implemented.

---

## SECTION 7 — Actor Bank Tab

**Files:** `src/components/ActorBank/ActorBankView.jsx`, `ActorCard.jsx`, `ActorBankFilters.jsx`, `ActorDetail.jsx` and their `.module.css` counterparts.

### 7.1 Grid View (ActorBankView)

**Data source:** `GET /api/characters` with filter params. Non-archived characters only by default; `includeArchived=only` for the archived section.

**ActorCard** shows per character:
- Thumbnail (`thumbnailUrl` — `front_portrait` or first available image). Position-relative for the status badge overlay.
- **Lifecycle status badge** — absolute-positioned pill at the bottom-left of the thumbnail. Colours: `ready`=green, `portfolio_pending`=amber (labelled "rendering"), `portfolio_failed`=red, `auditioned`=blue, `preview`=purple.
- **Image count** — shown in the meta line alongside age + genderPresentation.
- **Archived visual state** — `opacity: 0.55; filter: grayscale(0.4)` when `archived_at` is non-null.

**`archived_at` availability:** `listCharacters` and `getCharacter` in `repositories.js` both SELECT `archived_at` alongside `payload_json` and merge it into the returned object. It is NOT stored inside `payload_json`.

**Filters (ActorBankFilters):**
- Search (by name or cinematicArchetype) — debounced 300ms
- Gender chips (All / Male / Female / Non-binary)
- Age range (ageMin, ageMax)
- **Sort select** — three options: `last_rendered_at` (Recent renders, default), `created_at` (Recently created), `name` (A–Z). Sort `name` uses `LOWER(JSON_EXTRACT(payload_json, '$.name')) ASC` in `repositories.js`.

**Archived toggle:** "Show archived" button in the header. When active, makes a second fetch with `includeArchived=only` and renders the results in a separate section below the active grid. Toggling off clears the section. Filter changes refresh both lists when the toggle is on.

### 7.2 Detail View (ActorDetail)

Opened by selecting a card in the grid. Loaded via `GET /api/characters?id=<id>` which returns the character plus `images[]` (each with `imageUrl`, `viewType`, `approved`).

**Top bar actions (left to right):**
- **← Back to Actor Bank** — navigates back to grid (no reload)
- **Open in Casting Room →** — switches `activeTab` to `'pipeline'` in App.jsx and sets `jumpToCharacterId` → consumed by `CastingPipelinePanel.jumpToCharacterId` useEffect which calls `setSelectedCharacterId(id)` then fires `onJumpConsumed()`.
- **Archive / Restore** — calls `POST /api/character-archive` or `POST /api/character-restore`; on success calls `onArchive`/`onRestore` in parent (`handleDelete` — navigates back + reloads active grid).
- **Delete** — two-step confirmation; calls `DELETE /api/characters?id=<id>`.

**Hero section:**
- Character name is a clickable button (`cursor: text`). Clicking enters **inline rename mode**: a pre-filled input appears; Enter commits (calls `POST /api/character-rename`), Escape or blur cancels. Name updates locally on success.
- Archived characters show an "archived" badge in the hero.
- Meta line: age · genderPresentation · cinematicArchetype.

**Portfolio re-queue banner (AB6):**
- When `lifecycleStatus === 'portfolio_failed'`: red-tinted banner + "Re-queue portfolio" button. Calls `POST /api/character-portfolio-queue` with `{ characterId }`. On success, local status updates to `'portfolio_pending'`.
- When `lifecycleStatus === 'portfolio_pending'`: neutral info banner ("Portfolio generation in progress…").

**Reference images section:**
- Strip of all generated images for this character.
- **Keep / Discard buttons** under each image:
  - Keep → `POST /api/generated-image-approve` with `{ id }` → sets `approved: true`; green checkmark badge appears on image.
  - Discard → `POST /api/generated-image-reject` with `{ id }` → sets `approved: false`; image fades to 45% opacity.
- Discarded images are **hidden by default**. A "show N discarded" toggle in the section header reveals them.
- State updates locally on success (no full reload).

**Profile sections:** Face, Skin & Hair, Body, Screen presence — same as before. Distinctive features and visual keywords chips.

---

## SECTION 8 — Cross-Cutting Systems

### 8.1 Character Lifecycle — Complete State Machine

```
Creation paths:
  auditionOrchestrator → createCharacter(... lifecycleStatus='auditioned') ──→ [auditioned]
  batchGeneration → createCharacter(... lifecycleStatus='auditioned')       ──→ [auditioned]
  batch-candidate-preview → createCharacter(... lifecycleStatus='preview')  ──→ [preview]

Transitions:
  [auditioned] ─── portfolio queue (Approve+Portfolio / Queue Portfolio) ───→ [portfolio_pending]
  [preview]    ─── (temp only, deleted after preview render ingested)
  [portfolio_pending] ─── all jobs failed in portfolio poll tick ───────────→ [portfolio_failed]
  [portfolio_pending] ─── first image approved in gallery ────────────────→ [ready]
  [portfolio_failed]  ─── (no automatic recovery; manual re-queue required)
  [ready]      ─── first image approved in gallery (already ready — no-op transition, keeps 'ready')
  Any          ─── /api/character-lifecycle POST with valid status value ──→ [requested status]
  Any          ─── archiveCharacter() ──────────────────────────────────→ archived_at set (not a lifecycle_status change)
  Any          ─── restoreCharacter() ────────────────────────────────→ archived_at cleared
```

**Note on `portfolio_failed`:** The transition fires in the portfolio poll tick when all jobs complete with `status='failed'` and no jobs have `retryCount >= 2`. This is automatic, not manually triggered. Recovery: "Re-queue portfolio" button in ActorDetail (Actor Bank) or "Queue Portfolio" in the Active Character section (Casting Room) — both call `POST /api/character-portfolio-queue`.

**Note on `preview` status:** Only used for temporary characters created during batch preview rendering. These characters are deleted after image ingestion; the `preview` status is never promoted to any other status.

**Valid lifecycle_status values (from `/api/character-lifecycle` handler):**
`'auditioned'`, `'preview'`, `'portfolio_pending'`, `'portfolio_failed'`, `'ready'`

---

### 8.2 Vector / Chroma System

**What gets indexed:** Characters from the `characters` table. The text embedded is constructed from the character profile fields (name, description, cinematicArchetype, etc.) — the specific text construction is in `api/lib/vector/characterIndexing.js` (not read in full).

**Embedding model/provider:** Configured via `LLM_PROVIDER`:
- Default: Ollama with model `OLLAMA_EMBED_MODEL` (default: `nomic-embed-text`)
- If `LLM_PROVIDER=lmstudio`: LM Studio with `LMSTUDIO_EMBED_MODEL` (default: `nomic-embed-text-v1.5`)

**Similarity thresholds (from `batchGeneration.js`):**
- Distance ≤ 0.18: `'rejected'` (hard reject — too similar)
- Distance ≤ 0.28: `'needsMutation'` (needs modification)
- Distance > 0.28: `'accepted'`

These same thresholds are used at Save to Cast time (`saveCandidateAsCharacter` in `batchReview.js` uses 0.28 as the `similar` threshold — below 0.28 triggers similarity warning).

**Re-indexing:**
- Automatic: triggered by `saveCandidateAsCharacter()` (async, non-critical) on Save to Cast.
- Manual: via `POST /api/vector-index-character` (single) or `POST /api/vector-reindex-characters` (bulk).
- NOT automatic on character creation (embeddingStatus starts as `'not_indexed'`).

**C3 / Save to Cast re-check:** Confirmed implemented. `saveCandidateAsCharacter` in `batchReview.js` runs `findSimilarCharacters()` before saving if vector store is available and `force=false`.

**Chroma auto-spawn:** `vite.config.js` spawns a `chroma run --path ./chroma_data` process on dev server start if Chroma is not already running on port 8000. Checks both `/api/v2/heartbeat` and `/api/v1/heartbeat`. On Windows, runs via `cmd /c chroma run ...`. Process is killed on dev server exit.

**`/api/vector-*` routes:**
- `/api/vector-status` — health and stats
- `/api/vector-index-character` — index single character
- `/api/vector-reindex-characters` — bulk reindex
- `/api/vector-similar-by-character` — similarity by character ID
- `/api/vector-similar-by-text` — similarity by free text

---

### 8.3 ComfyUI Integration

**Workflow support:** Multiple workflows are supported. Available workflows are listed via `GET /api/comfy-workflows` → `createComfyService({ env }).listWorkflows()`. The specific workflow files are in `api/lib/comfy/` (not examined in detail). A default/fallback workflow is used when `allowWorkflowFallback=true`.

**Prompt pack → ComfyUI format:** `service.queuePromptPackById()` reads the prompt pack from DB, formats it into the ComfyUI workflow API format, and POSTs to `${COMFY_BASE_URL}/prompt`. The exact node mapping is in `api/lib/comfy/comfyService.js` (not read in full).

**Polling/SSE for job status:**
- SSE: Server opens a watcher interval (2s) polling `${comfyBaseUrl}/history?max_items=40`. On job completion, broadcasts `render-update` event with `{ promptId, status }`.
- Frontend polling: 20-second `setInterval` fallback.
- Status is also checked on-demand via `POST /api/comfy-jobs-status` (batch status check).

**Image ingest path:**
1. Poll tick detects `status='success'` for a promptId not yet in `ingestedRef`.
2. Calls `POST /api/comfy-ingest-many` with job details.
3. Server: calls `service.getJobStatus(promptId)` to get history, then `service.ingestHistoryOutputs()` which extracts image filenames from history outputs and creates `generated_images` DB records with ComfyUI image metadata.
4. Frontend refreshes gallery images.

**ComfyUI offline behavior:** If `createComfyService()` throws, the audition orchestrator catches it and proceeds with `comfyService=null` — audition results are created in DB but no renders are queued. The portfolio queue endpoints throw 502. The batch preview endpoint throws 502.

**Job persistence:** SQLite `comfy_jobs` table (H3 is implemented and active).

---

### 8.4 Navigation and Routing

**Tab navigation:** State-based switching via `activeTab` useState in `App.jsx`. Four tabs: `'builder'`, `'characters'`, `'pipeline'`, `'actorBank'`. No router library (no React Router, no URL-based tab routing).

**State persistence on tab switch:** State is held in React component state in `App.jsx`. Switching tabs does not clear state — all Prompt Builder state (chips, scene, director, etc.) persists when switching to Casting Room and back.

**URL-based routing:** The share URL feature encodes workspace state as a base64 JSON blob in the URL hash (`#state=...`). This is decoded on mount (`useEffect` reads `window.location.hash`). It is not true routing — there are no URL paths for different tabs.

**URL share encoding covers:** `scene`, `dirKey`, `charCount`, `chars`, `scenario`, `chips`, `blendEnabled`, `blendDir`, `blendWeight`, `narrativeBeat`, `useStyleKeyForPolish`, `aiEngine`, `localOnly`.

**Cross-tab imperative bridge (Actor Bank → Casting Room):** `App.jsx` holds `castingRoomJumpId` state (null or a character id). `handleOpenInCastingRoom(id)` sets `activeTab='pipeline'` and `castingRoomJumpId=id`. These are passed to `CastingPipelinePanel` as `jumpToCharacterId` and `onJumpConsumed`. A `useEffect` in `CastingPipelinePanel` calls `setSelectedCharacterId(jumpToCharacterId)` and fires `onJumpConsumed()` when the prop is non-null. `selectedCharacterId` is never lifted to App.jsx — the bridge is one-directional and self-clearing.

---

### 8.5 APP_MODE

**Valid values:** `'local-studio'` (default), `'cloud'`

**What each mode gates:**

`local-studio` (default):
- All operations permitted if corresponding ENABLE_* flag is set.

`cloud`:
- `assertCharacterBatchOperationAllowed`: only `list-batches`, `get-batch`, `list-candidates`, `list-characters` are allowed. All write operations (generate-batch, candidate-approve, candidate-save, etc.) are blocked with 403.
- `assertComfyOperationAllowed`: only `status` is allowed. All queue/ingest operations blocked with 403.
- `/api/vector-status`: returns a stub all-unavailable response without querying DB.
- `/api/comfy-status`: returns `available=false`.

**Where it is checked (explicit list):**
- `api/lib/characters/access.js` — `assertCharacterBatchOperationAllowed()`
- `api/lib/comfy/access.js` — `assertComfyOperationAllowed()`
- `api/lib/vector/access.js` — `assertVectorOperationAllowed()` and `sanitizeVectorStatusForMode()`
- `api/lib/prompts/access.js` — `assertPromptPackOperationAllowed()`
- `api/lib/generatedImages/access.js` — `assertGeneratedImagesOperationAllowed()`
- Inline in vite.config.js handlers for `/api/comfy-status` and `/api/vector-status`

---

## SECTION 9 — Known Gaps and In-Progress Work

### Actor Bank UI (full implementation)
**Status: DONE (P6).** Full management UI built across AB1–AB7: lifecycle badges, image count, archived toggle, inline rename, archive/restore, image keep/discard, sort options, portfolio re-queue, "Open in Casting Room" cross-tab bridge. See Section 7 for complete feature inventory.

### C2 — Generate Previews side effect (temp character records)
**Gap:** `POST /api/batch-candidate-preview` creates a temporary `characters` row to compile a prompt pack and queue a render. C2 was the intention to use transient/non-persisted preview images on candidate records directly without creating character records.
**Current actual state:** Temporary character records are created and then deleted after image ingest (or on failed render). The deletion is best-effort (`deleteTempCharacter(...).catch(() => {})`). The `preview_image_url` column on `character_batch_candidates` stores the result.
**Status:** Partially implemented. Preview images work. Temp characters are created and cleaned up. True "no character record" approach not implemented.

### C3 — Similarity re-check at Save to Cast
**Status: DONE.** `saveCandidateAsCharacter` in `batchReview.js` performs similarity check (threshold 0.28) before saving. Returns `{ warning: 'similar_character_found' }` if similar character found. UI shows confirmation dialog.

### H1 — Auto-select timing fix for Path A
**Current state:** Auto-selection in Path A fires during/after generation, not explicitly on approval. After `handleGenerateAudition()`, the character is added to `savedCharacters` and background prompt pack compilation starts. There is no explicit auto-select to the first character — the user selects from the dropdown. The `selectedCharacterId` is not set in `handleGenerateAudition()` — it is set only in `handleApproveAndQueuePortfolio()`. The comment `9p1+ef3` in the code references an auto-select fix but the implementation sets the character dropdown to populate, not auto-select. Previous documentation of "auto-select fires on approval" may be the intended behavior that was implemented — `setSelectedCharacterId(characterId)` IS called inside `handleApproveAndQueuePortfolio()`.
**Status:** Auto-select on approval is implemented in `handleApproveAndQueuePortfolio`.

### H3 — ComfyUI job persistence to SQLite
**Status: DONE.** `comfy_jobs` table exists and is used. Jobs are saved via `saveComfyJobs()` on both audition and portfolio queue. Active jobs are restored from DB on mount.

### SSE endpoint (M4/M5)
**Status: DONE.** `/api/render-events` SSE endpoint exists and is functional. Frontend subscribes via `EventSource`. `RenderStatusBar` shows live vs polling state.

### Saved prompts migration to SQLite
**Status: DONE.** Saved prompts are stored in the `saved_prompts` SQLite table. One-time migration from `localStorage['qpb_saved_prompts_v1']` runs on mount if DB is empty and localStorage has entries.

### Workspace profiles migration to SQLite
**Status: DONE.** Workspace profiles are stored in `workspace_profiles` SQLite table. Same one-time migration from `qpb_workspace_profiles_v1`.

### Prompt Builder ↔ Actor Bank character integration
**Status: DONE (pv9).** Two integrations implemented:
1. **Character slot linking** — each character slot in DirectorSection can be linked to an Actor Bank character via a "link actor…" dropdown. When linked, `bankCharDesc` replaces `getCharDesc(g, a)` as the `c[0]`/`c[1]`/`c[2]` value in director scenario templates.
2. **`@slug` expansion** — `effectiveCharacters = { ...bankCharDict, ...characters }` is passed to `assemblePrompt`. Actor Bank characters are available as `@slug` tokens in scene input (e.g. `@aria_chen` expands to that character's `optimizedDescription`). localStorage Character Builder entries win on slug collision.
See Section 4.1 (state variables) and Section 4.3 (director system) for implementation details.

### Custom directors cap
**Note:** `customDirectors` array is capped at 3 entries (enforced in `saveCustomDirector` in `App.jsx`).

---

## SECTION 10 — File and Component Reference

### Root

| File | What it does | Section |
|---|---|---|
| `vite.config.js` | All API route handlers registered as Vite dev middleware; Chroma auto-spawn; SSE watcher | §3 |
| `index.html` | SPA entry point | — |
| `package.json` | Dependencies; scripts | — |
| `.env.local` | Local environment variables (not committed) | §3 |
| `vercel.json` | Vercel deployment config (present but not the operative deployment) | — |

### `src/`

| File | What it does | Section |
|---|---|---|
| `src/App.jsx` | Root component; all Prompt Builder state; tab switching; blend, presets, profiles | §4.1 |
| `src/index.css` | Global styles | — |

### `src/components/`

| File | What it does | Section |
|---|---|---|
| `PromptOutput.jsx` | Assembled prompt display, polish, variants, history, saved prompts, quality score | §4.6, §4.7, §4.9, §4.10, §4.11 |
| `ChipSection.jsx` | Chip group toggle UI | §4.2 |
| `DirectorSection.jsx` | Director selection, blend config, scenario picker | §4.3, §4.4 |
| `SceneMatcher.jsx` | Free-text search across director/scene corpus | §4.5 |
| `SceneInput.jsx` | Scene text input | §4.2 |
| `SceneDeck.jsx` | Pre-authored scene deck cards | §4.2 |
| `SceneScaffold.jsx` | Scaffold paragraph/chip suggestions | §4.2 |
| `CharacterBuilder.jsx` | Character bank entry form and management | §5 |
| `CastingPipelinePanel.jsx` | Entire Casting Room (Path A + B + Active Character + render system) | §6 |
| `BatchExplorer.jsx` | Batch list/management UI helper | §6.2 |
| `EmbeddedSetup.jsx` | Embedded sidecar configuration panel | §4.10 |
| `ReferenceBoard.jsx` | Reference image analysis board | — |
| `CommandPalette.jsx` | Keyboard-driven command palette (Ctrl/Cmd+K) | §4.1 |
| `Header.jsx` | App header with clear button | — |
| `MobilePromptBar.jsx` | Mobile prompt display bar | — |

### `src/components/ActorBank/`

| File | What it does | Section |
|---|---|---|
| `ActorBankView.jsx` | Actor Bank tab root — grid + detail routing | §7 |
| `ActorCard.jsx` | Single character card in grid | §7 |
| `ActorDetail.jsx` | Full character detail view with images and delete | §7 |
| `ActorBankFilters.jsx` | Search/gender/age filter controls | §7 |

### `src/components/CastingRoom/`

| File | What it does | Section |
|---|---|---|
| `CharacterCard.jsx` | Character card component (used in casting room) | §6 |

### `src/utils/`

| File | What it does | Section |
|---|---|---|
| `assembler.js` | `rewriteScene`, `assemblePrompt`, `dedupeFragments`, `getCharDesc` | §4.2 |
| `qualityScore.js` | `scorePromptQuality` with 6-component scoring | §4.7 |
| `promptRules.js` | `validatePromptRules`, `applyRuleFix`, conflict detection | §4.8 |
| `variants.js` | `generatePromptVariants` — 3 variant types | §4.9 |
| `slugify.js` | `toSnakeSlug`, `withUniqueSuffix`, `resolveCharacterSlug` | §5 |
| `sceneSearch.js` | `searchCorpus` — local text search for SceneMatcher | §4.5 |
| `downloadPromptFile.js` | Export prompt to .txt file | §4.11 |

### `src/data/`

| File | What it does | Section |
|---|---|---|
| `constants.js` | `REWRITES` (29), `DEFAULTS`, `FEATURED_PRESETS` (6), `DIRECTOR_PRESETS` (61), `PRESETS` | §4.2, §4.3 |
| `directors.js` | `DIRECTORS` object — 61 directors with scenarios | §4.3 |
| `chips.js` | `CHIP_GROUPS` structure, `NEGATIVE_PROMPT` | §4.2 |
| `sceneBank.js` | `getSceneBankEntry` — scene bank lookup used for styleKey | §4.10 |

### `src/hooks/`

| File | What it does | Section |
|---|---|---|
| `usePolish.js` | Polish state machine hook wrapping `/api/polish` | §4.10 |
| `useWorkspaceHistory.js` | Undo/redo for workspace state | §4.1 |
| `useCharacterOptimize.js` | Character description optimization hook | §5 |
| `useSectionState.js` | Collapsible section open/closed state | §4.5 |

### `src/lib/api/` and `src/api/`

| File | What it does | Section |
|---|---|---|
| `src/lib/api/characterBatches.js` | Frontend API wrappers for batch operations | §6.2 |
| `src/lib/api/characterBank.js` | Frontend API wrappers for bank entries | §5 |
| `src/lib/api/comfy.js` | Frontend API wrappers for ComfyUI | §8.3 |
| `src/lib/api/generatedImages.js` | Frontend API wrappers for image review | §6.3 |
| `src/lib/api/portfolio.js` | Frontend API wrappers for portfolio queue | §6.3 |
| `src/lib/api/audition.js` | Frontend API wrapper for audition generate | §6.1 |
| `src/lib/api/actorAuditions.js` | Frontend API wrappers for actor audition approve/reject | §6.1 |
| `src/lib/api/promptPacks.js` | Frontend API wrappers for prompt pack compile/list | §6.3 |
| `src/api/promptStorage.js` | Frontend API wrappers for saved prompts and workspace profiles | §4.11 |

### `api/lib/`

| File | What it does | Section |
|---|---|---|
| `api/lib/db/schema.js` | All CREATE TABLE and MIGRATIONS SQL | §2 |
| `api/lib/db/repositories.js` | All DB query functions | §2 |
| `api/lib/db/sqlite.js` | SQLite connection creation and database initialization | §2 |
| `api/lib/polishCore.js` | System prompt, provider resolution, `runPolish`, `healthCheck`, `buildUserMessage` | §4.10 |
| `api/lib/characterLifecycle.js` | Lifecycle transition functions (`setAuditioned`, etc.) | §8.1 |
| `api/lib/characters/batchGeneration.js` | `runBatchCharacterGeneration`, similarity thresholds, classification | §6.2, §8.2 |
| `api/lib/characters/batchReview.js` | Batch review actions, `saveCandidateAsCharacter`, C3 similarity check | §6.2 |
| `api/lib/characters/schemas.js` | Zod schemas for character profile and related types | §2 |
| `api/lib/characters/access.js` | `assertCharacterBatchOperationAllowed` — APP_MODE gating | §8.5 |
| `api/lib/characters/prompts.js` | LLM prompt templates for batch generation | §6.2 |
| `api/lib/audition/auditionOrchestrator.js` | `runAudition` — Path A full flow | §6.1 |
| `api/lib/audition/auditionPrompts.js` | LLM prompt template for audition generation | §6.1 |
| `api/lib/comfy/comfyService.js` | ComfyUI API client — queue, status, ingest | §8.3 |
| `api/lib/comfy/access.js` | `assertComfyOperationAllowed` — APP_MODE gating | §8.5 |
| `api/lib/vector/runtime.js` | `createVectorRuntime` — DB + Chroma + embeddings | §8.2 |
| `api/lib/vector/maintenance.js` | `indexCharacterById`, `reindexCharacters`, `findSimilarCharactersById`, etc. | §8.2 |
| `api/lib/vector/chromaVectorStore.js` | Chroma client wrapper | §8.2 |
| `api/lib/vector/access.js` | `assertVectorOperationAllowed`, `sanitizeVectorStatusForMode` | §8.5 |
| `api/lib/vector/characterIndexing.js` | `findSimilarCharacters` used by batch generation | §8.2 |
| `api/lib/prompts/qwenPromptCompiler.js` | Prompt pack compilation logic | §6.3 |
| `api/lib/prompts/access.js` | `assertPromptPackOperationAllowed` | §8.5 |
| `api/lib/portfolio/characterPortfolio.js` | `generateCharacterPortfolioPlan`, `queueCharacterPortfolio` | §6.3 |
| `api/lib/characterOptimizeCore.js` | `runCharacterOptimize` — LLM character description rewriter | §5 |
| `api/lib/referenceImageCore.js` | `runReferenceImageAnalysis` | §3 |
| `api/lib/embeddings/ollamaEmbeddingProvider.js` | Ollama embedding client | §8.2 |
| `api/lib/embeddings/lmStudioEmbeddingProvider.js` | LM Studio embedding client | §8.2 |
| `api/lib/llm/providers/claudeProvider.js` | Anthropic Claude API client | §4.10 |
| `api/lib/llm/providers/ollamaProvider.js` | Ollama LLM client | §4.10 |
| `api/lib/llm/providers/lmStudioProvider.js` | LM Studio LLM client | §4.10 |
| `api/lib/llm/providers/mockProvider.js` | Mock LLM for testing | §4.10 |
| `api/lib/llm/providers/shared.js` | Shared constants (`DEFAULT_OLLAMA_URL`, `DEFAULT_LMSTUDIO_URL`, etc.) | §3, §4.10 |
| `api/lib/http.js` | `readJsonBody`, `sendJsonMiddleware`, `normalizeHandlerError` | §3 |
| `api/lib/generatedImages/access.js` | `assertGeneratedImagesOperationAllowed` | §8.5 |

---

*End of APPLICATION_REFERENCE.md — written from source code, no TBDs.*
