# AGENT HANDOFF — Qwen Prompt Builder

**Stack:** React 18 + Vite frontend, Vite middleware API (no separate server), better-sqlite3 SQLite, Chroma vector DB, ComfyUI, LLM providers (Ollama / LM Studio / Claude cloud)
**Deploy mode:** Local-only. `APP_MODE=local-studio`. No production cloud deployment.

---

## What This Application Does

Qwen Prompt Builder (QPB) is a local-first creative tool for constructing, managing, and rendering cinematic text-to-image prompts, targeting the Qwen image generation model via a locally-running ComfyUI instance. It combines a structured prompt assembly interface (director aesthetics, scenario templates, chip modifiers) with a full character casting and portfolio pipeline: users describe characters, generate AI actor profiles via LLM, queue portrait renders through ComfyUI, and manage the resulting image library. The entire application runs on a developer machine — Vite's dev server serves both the React frontend and all API routes as middleware plugins from `vite.config.js`.

---

## Four Tabs and Their Dependency Relationships

**Tab 1 — Prompt Builder** (`activeTab='builder'`)
Constructs and refines a single text-to-image prompt from freetext scene input, director style chips (61 directors), scenario templates, and an optional LLM polish pass. This tab is independent of the other three — it does not read from or write to the character/casting database, except that Character Builder entries can be referenced as `@slug` tokens in the scene input.

**Tab 2 — Character Builder** (`activeTab='characters'`)
Creates and manages named character bank entries stored in the `character_bank_entries` SQLite table and mirrored to `localStorage['qpb_characters_v1']`. These entries are the input for the Casting Room's Path A (audition) flow. The `@slug` token system in the Prompt Builder reads from this same localStorage key.

**Tab 3 — Casting Room** (`activeTab='pipeline'`)
Generates AI actor portfolios through two paths:
- **Path A (Audition):** Select a bank entry → LLM generates N character profiles → ComfyUI renders portrait views → user reviews and approves candidates.
- **Path B (Batch):** Generate diverse character candidates with vector similarity screening → review/approve → save to cast.
Also hosts the Active Character section for renaming, archiving, compiling prompt packs, queuing portfolio renders, and managing the generated image gallery.

**Tab 4 — Actor Bank** (`activeTab='actorBank'`)
Read-oriented browser of the `characters` table. Shows rendered character cards with filters (search, gender, age). Most write actions happen in the Casting Room. Selecting a character in the Actor Bank does NOT affect the Casting Room's active character — the tabs do not communicate.

**Dependency chain:**
- Character Builder → Casting Room Path A (bank entries consumed by audition)
- Casting Room → Actor Bank (characters table is what Actor Bank displays)
- Prompt Builder is independent (reads Character Builder's localStorage for `@slug` expansion only)
- Actor Bank has no write relationship with Prompt Builder

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, CSS Modules, no UI library |
| API | Vite dev-server middleware plugins in `vite.config.js` (no Express/Fastify) |
| Database | SQLite via `better-sqlite3` (`api/lib/db/sqlite.js`) |
| Vector store | Chroma (`localhost:8000`, auto-spawned by vite.config.js on dev start) |
| Image generation | ComfyUI (`localhost:8188`) |
| LLM — local | Ollama (`localhost:11434`) or LM Studio (configurable URL) |
| LLM — cloud | Anthropic Claude API (fallback; requires `ANTHROPIC_API_KEY`) |
| Embeddings | Ollama `nomic-embed-text` or LM Studio `nomic-embed-text-v1.5` |
| Tests | Vitest (`npm test`) |

---

## API Surface (10 Domains, 47+ Routes)

All routes are registered in `vite.config.js` as Vite middleware. Prefix: `/api/`.

| Domain | Routes | Gating |
|---|---|---|
| Polish | `POST /api/polish`, `GET /api/polish-health` | Always available |
| Characters (CRUD + lifecycle) | `GET/DELETE /api/characters`, `POST /api/character-lifecycle`, `POST /api/character-rename`, `POST /api/character-archive`, `POST /api/character-restore` | `ENABLE_CHARACTER_BATCH_API` for list/delete |
| Casting / Audition (Path A) | `POST /api/audition/generate` | None |
| Batch pipeline (Path B) | `POST /api/characters-generate-batch`, `GET /api/character-batches`, `GET /api/character-batch`, `GET /api/character-batch-candidates`, `POST /api/character-batch-candidate-approve/reject/reconsider/save/mutate`, `POST /api/character-batch-refill`, `POST /api/batch-candidate-preview`, `POST /api/batch-candidate-preview-image` | `ENABLE_CHARACTER_BATCH_API` |
| Prompt packs | `POST /api/prompt-pack-compile-character`, `POST /api/prompt-pack-compile-batch`, `GET /api/prompt-packs` | `ENABLE_PROMPT_PACK_API` |
| Portfolio | `POST /api/character-portfolio-plan`, `POST /api/character-portfolio-queue`, `POST /api/actor-more-takes` | `ENABLE_PROMPT_PACK_API` + `ENABLE_COMFY_API` |
| ComfyUI integration | `GET /api/comfy-status`, `GET /api/comfy-workflows`, `POST /api/comfy-validate-workflow`, `POST /api/comfy-queue-prompt-pack`, `POST /api/comfy-queue-character`, `GET /api/comfy-job-status`, `POST /api/comfy-jobs-status`, `GET/POST/PATCH /api/comfy-jobs`, `POST /api/comfy-ingest-outputs`, `POST /api/comfy-ingest-many` | `ENABLE_COMFY_API` |
| Generated images | `GET /api/generated-images`, `POST /api/generated-image-approve`, `POST /api/generated-image-reject`, `GET /api/generated-image-view` | `ENABLE_GENERATED_IMAGES_API` |
| Vector / Chroma | `GET /api/vector-status`, `POST /api/vector-index-character`, `POST /api/vector-reindex-characters`, `POST /api/vector-similar-by-character`, `POST /api/vector-similar-by-text`, `GET /api/chroma-health` | `ENABLE_VECTOR_MAINTENANCE_API` |
| Character bank entries | `GET/POST/PUT/DELETE /api/character-bank` | None |
| Actor candidates + auditions | `GET/POST/PUT/DELETE /api/actor-candidates`, `GET/POST/PUT/DELETE /api/actor-auditions` | None |
| Saved prompts | `GET/POST/DELETE/PATCH /api/saved-prompts` | None |
| Workspace profiles | `GET/PUT/DELETE /api/workspace-profiles` | None |
| Reference image analysis | `POST /api/analyze-reference-image` | None |
| Character optimization | `POST /api/optimize-character` | None |
| SSE render events | `GET /api/render-events` | None |

---

## Database Tables (10 Tables)

Schema defined in `api/lib/db/schema.js`. All query functions in `api/lib/db/repositories.js`.

| Table | Purpose |
|---|---|
| `characters` | Generated character profiles (output of audition or batch-save). Has `lifecycle_status`, `embedding_status`, `archived_at`, `last_rendered_at` columns. |
| `character_bank_entries` | Character descriptions authored in the Character Builder tab (input specs for audition). Keyed by slug. |
| `prompt_packs` | Compiled prompt packs per character per view angle. Used to queue ComfyUI jobs. |
| `generated_images` | Records of ComfyUI output images with metadata (approve/reject state, view type). |
| `character_batches` | Batch generation sessions (Path B). Tracks batch status and summary. |
| `character_batch_candidates` | Individual LLM-generated candidates within a batch. Has review/classification state. |
| `actor_candidates` | Actor candidate records linked to bank entries and prompt packs. |
| `actor_auditions` | Audition records linking actor candidates to bank entries with status. |
| `saved_prompts` | Named prompt snapshots from the Prompt Builder (migrated from localStorage). |
| `workspace_profiles` | Named workspace state snapshots for the Prompt Builder (migrated from localStorage). |
| `comfy_jobs` (migration 6) | Persistent ComfyUI job tracking — survives page reloads. Keyed by `prompt_id` (UNIQUE). |

---

## Character Lifecycle States

Valid values for `lifecycle_status` column in `characters` table:

| Status | Meaning |
|---|---|
| `auditioned` | Default on creation. Character generated but no portfolio render queued. |
| `preview` | Temporary — used only for batch preview renders. Deleted after image ingestion. |
| `portfolio_pending` | Portfolio render queued to ComfyUI. |
| `portfolio_failed` | All portfolio jobs failed. Requires manual re-queue. |
| `ready` | At least one generated image has been approved. |

Soft-archive is separate: `archived_at` column (ISO timestamp if archived, NULL if active).

---

## Key Files

| File | Role |
|---|---|
| `src/App.jsx` | Root component; all Prompt Builder state; tab switching; blend, presets, profiles |
| `src/utils/assembler.js` | `rewriteScene`, `assemblePrompt`, `dedupeFragments`, `getCharDesc` |
| `api/lib/polishCore.js` | System prompt, provider resolution, `runPolish`, `healthCheck` |
| `vite.config.js` | All 47+ API route handlers registered as Vite middleware; Chroma auto-spawn; SSE watcher |
| `api/lib/db/schema.js` | All CREATE TABLE SQL + MIGRATIONS array |
| `api/lib/db/repositories.js` | All DB query functions |
| `src/components/CastingPipelinePanel.jsx` | Entire Casting Room — Path A + B + Active Character + render system |
| `src/components/ActorBank/ActorBankView.jsx` | Actor Bank tab root |
| `src/components/CharacterBuilder.jsx` | Character bank entry form and management |
| `api/lib/characterLifecycle.js` | Lifecycle transition functions |
| `api/lib/characters/batchGeneration.js` | Batch generation, similarity thresholds, classification |
| `api/lib/audition/auditionOrchestrator.js` | Path A full orchestration |
| `src/data/directors.js` | 61 directors with scenarios |
| `src/data/constants.js` | REWRITES (29), DEFAULTS, DIRECTOR_PRESETS (61), FEATURED_PRESETS (6) |

---

## What Is In-Progress or Not Yet Built

The following features are absent from the current codebase (from APPLICATION_REFERENCE.md Section 9):

- **Actor Bank full implementation:** The Actor Bank tab is a functional read-only browser. Advanced features are not built: direct "Cast from Actor Bank" integration, Actor Bank ↔ Prompt Builder `@slug` token integration, lifecycle management in the Actor Bank, advanced portfolio management actions. The infrastructure (tables, APIs) exists; the UI layer is minimal. This is tracked in beads issue `qwen-prompt-builder-pv9`.
- **Prompt Builder ↔ Actor Bank character integration:** The `@slug` token system reads from the Character Builder's localStorage, not from the Actor Bank's `characters` table. A rendered Actor Bank character cannot be referenced as `@slug` in the Prompt Builder. Not built.
- **Reference image AI Vision extraction:** The `POST /api/analyze-reference-image` route exists but AI Vision extraction from reference images is not implemented in the current code. The ReferenceBoard component exists but serves as a visual reference holder only.
- **Composition Modifiers panel:** Not present in the current chip groups.
- **Time / Weather Quick-Set buttons:** Not present in the current UI.
- **Garment / Clothing Expander panel:** Not present as a panel; some garment rewrites exist in the REWRITES table.

---

## Director Count

**61 directors** — verified by counting top-level keys in `src/data/directors.js`. Do not write 60 or 25.

---

## External Service Dependencies

| Service | Default URL | What breaks if absent |
|---|---|---|
| ComfyUI | `localhost:8188` | All image rendering; audition/portfolio queue returns 502 |
| Ollama | `localhost:11434` | Polish falls back to cloud; vector indexing fails if primary provider |
| LM Studio | configurable | Same as Ollama if configured as primary |
| Chroma | `localhost:8000` | Similarity checks skip silently; batch dedup bypassed gracefully |
| Anthropic Claude API | cloud | Cloud polish fails with 4xx if key absent; local providers remain functional |

Chroma is auto-spawned by `vite.config.js` on dev server start (`chroma run --path ./chroma_data`). On Windows, this runs via `cmd /c chroma run ...`.
