# AGENT HANDOFF — Qwen Prompt Builder

**Stack:** React 18 + Vite frontend, Vite middleware API (no separate server), better-sqlite3 SQLite, Chroma vector DB, ComfyUI, LLM providers (Ollama / LM Studio / Claude cloud)
**Deploy mode:** Local-only. `APP_MODE=local-studio`. No production cloud deployment.

---

## What This Application Does

Qwen Prompt Builder (QPB) is a local-first creative tool for constructing, managing, and rendering cinematic text-to-image prompts, targeting the Qwen image generation model via a locally-running ComfyUI instance. It combines a structured prompt assembly interface (director aesthetics, scenario templates, chip modifiers) with a full character casting and portfolio pipeline: users describe characters, generate AI actor profiles via LLM, queue portrait renders through ComfyUI, and manage the resulting image library. The entire application runs on a developer machine — Vite's dev server serves both the React frontend and all API routes as middleware plugins from `vite.config.js`.

---

## Six-Step Workflow and Dependencies

The UI uses a **6-step workflow stepper** (`NavigationStepper.jsx`, `activeStep` in `App.jsx`). Steps 5–6 (Render, Portfolio) are placeholders.

**Step 1 — Casting** (`CastingStepContainer.jsx`, three sub-tabs)
- **Casting Pipeline** (`CastingPipelinePanel.jsx`, formerly Casting Room tab): Path A (audition from bank entry → LLM profiles → ComfyUI renders) and Path B (batch + vector similarity). Active Character section for portfolio management and image gallery.
- **Character Builder** (`CharacterBuilder.jsx`): Named bank entries in `character_bank_entries` SQLite (localStorage cache). Optional identity hints and guidance strength. Feeds Path A.
- **Actor Bank** (`ActorBank/ActorBankView.jsx`): Full `characters` table management — search/filter, rename, archive/restore, image curation, portfolio re-queue, prompt descriptor edit. **Open in Casting Room →** sets `activeSubTab='casting-pipeline'` within Step 1.

**Step 2 — Bible** (`BibleStepContainer.jsx`)
Lift selected character to an entity (`POST /api/entities/lift-from-bank-entry`). Edit entity bible in `src/features/bible/BibleEditor.jsx`. Manage visual anchors via `VisualAnchorPicker`. Requires `activeCharId` from Step 1.

**Step 3 — Extrapolation** (`ExtrapolationStepContainer.jsx`)
Type-aware extrapolation (`stageRegistry.js`), attribute review, Stage 6 conflict resolution, and MVP Done gate continuity QA — all embedded here (no standalone Continuity tab). Requires `activeEntityId` from Step 2. Panels: `EntityExtrapolationPanel`, `AttributeReviewPanel`, `EntityConflictPanel`, `EntityContinuityQaPanel`.

**Step 4 — Prompt Studio** (`PromptStudioStep.jsx`, formerly Prompt Builder)
Constructs and refines prompts from scene input, director chips (61 directors), scenarios, and LLM polish. State in `WorkspaceContext.jsx`. **Polish with AI** fuses assembled fragments; **Polish current text** re-polishes on-screen text. Actor Bank integration: character slot linking + `@slug` expansion via `effectiveCharacters`. Includes `BibleQuickRef` when an entity is active.

**Steps 5–6 — Render / Portfolio** — placeholders only.

**Dependency chain:**
- Casting (select `activeCharId`) → Bible (lift to `activeEntityId`) → Extrapolation → Prompt Studio
- Character Builder → Casting Pipeline Path A (bank entries)
- Casting Pipeline → Actor Bank (characters table)
- Actor Bank → Casting Pipeline (Open in Casting Room sets sub-tab within Step 1)
- Actor Bank → Prompt Studio (slot linking + `@slug` via `effectiveCharacters`)

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

## API Surface (14 Domains, 75+ Routes)

All routes are registered in `vite.config.js` as Vite middleware and/or auto-discovered from `api/routes/**/*.route.js` via `qpbDevServer`. Prefix: `/api/`.

| Domain | Routes | Gating |
|---|---|---|
| Projects | `GET/POST /api/projects`, `GET /api/projects/:id` | None |
| Bibles | `GET /api/bibles/:entityId`, snapshots, export (md/pdf), completeness, approve-section, extrapolate | None |
| Tools | `GET /api/tools`, `POST /api/tools/:name` | None |
| Agents | `POST /api/agents/autofill-bible` | None |
| Extrapolation streaming | `GET /api/extrapolation/:runId/status`, `GET /api/extrapolation/:runId/stream` | None |
| Polish | `POST /api/polish`, `GET /api/polish-health` | Always available |
| Characters (CRUD + lifecycle + descriptors) | `GET/DELETE /api/characters`, `POST /api/character-lifecycle`, `POST /api/character-rename`, `POST /api/character-archive`, `POST /api/character-restore`, `GET /api/characters/slugs`, `POST /api/character-prompt-descriptor`, `POST /api/characters-backfill-descriptors` | `ENABLE_CHARACTER_BATCH_API` for list/delete; descriptor endpoints always available |
| Casting / Audition (Path A) | `POST /api/audition/generate` | None |
| Batch pipeline (Path B) | `POST /api/characters-generate-batch`, `GET /api/character-batches`, `GET /api/character-batch`, `GET /api/character-batch-candidates`, `POST /api/character-batch-candidate-approve/reject/reconsider/save/mutate`, `POST /api/character-batch-refill`, `POST /api/batch-candidate-preview`, `POST /api/batch-candidate-preview-image` | `ENABLE_CHARACTER_BATCH_API` |
| Prompt packs | `POST /api/prompt-pack-compile-character`, `POST /api/prompt-pack-compile-batch`, `GET /api/prompt-packs`, `POST /api/promptpack/from-entity/:id` | `ENABLE_PROMPT_PACK_API` |
| Entities (worldbuilding layer) | `GET/POST/PUT/DELETE /api/entities` and `/api/entities/:id`; `POST /api/entities/lift-from-bank-entry`; `GET /api/entities/:id/attributes`; `GET/POST/PUT/DELETE /api/entities/:id/relationships`; `GET/POST/DELETE /api/entities/:id/anchors`, `POST /api/entities/:id/anchors/:anchorId/set-primary`; `POST /api/entities/:id/attributes/:attrId/promote|dismiss|edit`; `POST /api/entities/:id/conflicts/:cid/resolve|dismiss`; `POST /api/extrapolate/character/:id`, `POST /api/extrapolate/stage/:id/:n`, `POST /api/entities/:id/extrapolate/stage/:n` (stage 5 = reference portrait queue); `GET /api/entities/:id/mvp-done-gate`; `POST /api/entities/:id/continuity-qa/generate`; `GET /api/entities/:id/continuity-qa/scoring-sheet`; `POST /api/entities/:id/continuity-qa/scores` | None (local-studio) |
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

## Database Tables (14 Tables)

Schema defined in `api/lib/db/schema.js`. All query functions in `api/lib/db/repositories.js`.

| Table | Purpose |
|---|---|
| `characters` | Generated character profiles (output of audition or batch-save). Shadow columns: `lifecycle_status`, `embedding_status`, `archived_at`, `last_rendered_at`, `name`, `age`, `gender_presentation`, `cinematic_archetype`, `slug` (snake_case, unique), `prompt_descriptor` (15-25 word casting note for use in director scenario templates). |
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
| `entities` | Worldbuilding entities (`character`, `environment`, `prop`, `institution`, `location`, `era`) with soft-archive via `archived_at`. |
| `entity_attributes` | Provenance-tracked attributes (`canon`, `inferred`, `suggested`, `temporary`, `derived`); writes go through `writeAttribute` only. |
| `entity_relationships` | Directed relationships between entities with typed `type` and provenance. |
| `visual_anchors` | Reference images, seeds, and other continuity anchors per entity; one primary anchor per entity. |

---

## Character Lifecycle States

Valid values for `lifecycle_status` column in `characters` table:

| Status | Meaning |
|---|---|
| `auditioned` | Default on creation. Character generated but no portfolio render queued. |
| `preview` | Temporary — used only for batch preview renders. Deleted after image ingestion. |
| `portfolio_pending` | Portfolio render queued to ComfyUI. |
| `portfolio_failed` | All portfolio jobs failed. Re-queue available from Actor Bank detail view. |
| `ready` | At least one generated image has been approved. |

Soft-archive is separate: `archived_at` column (ISO timestamp if archived, NULL if active). This column is NOT inside `payload_json` — `listCharacters` and `getCharacter` must SELECT it explicitly and spread it onto the returned object.

---

## Key Files

| File | Role |
|---|---|
| `src/App.jsx` | Root shell; `activeStep` workflow navigation; project/entity/character selection state; delegates Prompt Studio state to `WorkspaceContext` |
| `src/context/WorkspaceContext.jsx` | Prompt Studio workspace state (scene, chips, director, profiles, polish prefs); undo/redo |
| `src/context/ProjectContext.jsx` | Active project selection |
| `src/utils/assembler.js` | `rewriteScene(raw, characters, actorBankSlugs)`, `assemblePrompt`, `dedupeFragments`, `getCharDesc(gender, age, promptDescriptor?)` |
| `src/utils/actorBankMapping.js` | `genderPresentationToG`, `ageToBracket` — derive chars `g`/`a` from Actor Bank character profile |
| `src/utils/slugify.js` | `toSnakeSlug`, `resolveCharacterSlug` — used by `@slug` expansion and Actor Bank character linking |
| `api/lib/polishCore.js` | System prompt, provider resolution, `runPolish`, `healthCheck` |
| `vite.config.js` | Legacy API route handlers as Vite middleware; `qpbDevServer` discovers `api/routes/**/*.route.js`; Chroma auto-spawn; SSE watcher |
| `api/lib/db/schema.js` | All CREATE TABLE SQL + MIGRATIONS array |
| `api/lib/db/repositories.js` | All DB query functions; entity CRUD, `writeAttribute`, relationship and visual-anchor repos; `listCharacters` and `getCharacter` both SELECT `archived_at` alongside `payload_json` and merge it into the returned object |
| `api/entities.js` | Entity CRUD route handler |
| `api/entity-relationships.js` | Entity-scoped relationship CRUD |
| `api/entity-anchors.js` | Visual anchor CRUD + set-primary (multipart upload for `reference_image`) |
| `api/entity-attribute-actions.js` | Attribute promote / dismiss / edit actions |
| `api/entity-conflict-actions.js` | S6 conflict resolve / dismiss |
| `api/entity-mvp-done-gate.js` | MVP Done gate readiness checklist |
| `api/entity-continuity-qa-generate.js` | Five-scene continuity QA queue |
| `api/entity-continuity-qa-scoring.js` | Blind-seed scoring sheet + acceptance decision |
| `api/entity-extrapolate.js` | Extrapolation pipeline + per-stage routes |
| `api/entity-extrapolate-stage5.js` | Stage 5 reference portrait queue |
| `api/promptpack-from-entity.js` | Entity prompt-pack compile route handler |
| `api/lib/extrapolation/stageRegistry.js` | Resolves extrapolation stage chain from entity `type` (character-shaped S1–S6, `location` three-stage pipeline, `era` placeholders) |
| `api/lib/extrapolation/orchestrator.js` | Pipeline + per-stage runner, stage cache, model routing |
| `api/lib/continuity/mvpDoneGate.js` | Readiness checks + continuity QA orchestration |
| `api/lib/comfy/ipadapterFeasibility.js` | IPAdapter feasibility decision for Qwen-Image |
| `api/lib/prompts/entityAttributeProfile.js` | Maps entity attributes into prompt-compiler profile shape |
| `src/components/EntityContinuityPanel.jsx` | Continuity tab shell |
| `src/components/EntityEditor.jsx` | Entity sections, extrapolation, review, conflicts |
| `src/components/EntityContinuityQaPanel.jsx` | MVP Done gate UI |
| `src/components/EntityConflictPanel.jsx` | Stage 6 conflict resolution UI |
| `src/components/CastingPipelinePanel.jsx` | Entire Casting Room — Path A + B + Active Character + render system; accepts `jumpToCharacterId`/`onJumpConsumed` props for cross-tab navigation |
| `src/components/ActorBank/ActorBankView.jsx` | Actor Bank tab root; archived toggle; passes `onOpenInCastingRoom` to ActorDetail |
| `src/components/ActorBank/ActorCard.jsx` | Character card with lifecycle badge, image count, archived state |
| `src/components/ActorBank/ActorBankFilters.jsx` | Filter bar with search, gender chips, age range, sort select |
| `src/components/ActorBank/ActorDetail.jsx` | Character detail — inline rename, archive/restore, image keep/discard curation, portfolio re-queue, "Open in Casting Room"; prompt descriptor section with inline edit, [Generate] and [Regenerate] buttons |
| `src/components/DirectorSection.jsx` | Director + character slot UI; "Import from Actor Bank" button opens `ActorBankPicker` per slot; when `actorBankId` is set, slot shows name/thumbnail + Clear button |
| `src/components/ActorBankPicker/ActorBankPicker.jsx` | Inline character picker popover — search + scroll list from `/api/characters/slugs`; `onSelect`, `onClose`, `excludeIds` props |
| `src/components/SceneInput.jsx` | Scene text input with `@slug` autocomplete dropdown (fires on `@`, Tab/Enter inserts, Esc dismisses) |
| `src/components/CharacterBuilder.jsx` | Character bank entry form and management |
| `api/lib/characterLifecycle.js` | Lifecycle transition functions |
| `api/lib/characters/batchGeneration.js` | Batch generation, similarity thresholds, classification |
| `api/lib/audition/auditionOrchestrator.js` | Path A full orchestration |
| `src/data/directors.js` | 61 directors with scenarios |
| `src/data/constants.js` | REWRITES (29), DEFAULTS, DIRECTOR_PRESETS (61), FEATURED_PRESETS (6) |

---

## What Is In-Progress or Not Yet Built

- **Reference image AI Vision extraction:** The `POST /api/analyze-reference-image` route exists but AI Vision extraction from reference images is not implemented in the current code. The ReferenceBoard component exists but serves as a visual reference holder only.
- **Composition Modifiers panel:** Not present in the current chip groups.
- **Time / Weather Quick-Set buttons:** Not present in the current UI.
- **Garment / Clothing Expander panel:** Not present as a panel; some garment rewrites exist in the REWRITES table.

The following were previously listed as gaps and are now complete:

- **Actor Bank full implementation (AB1–AB7, P6):** Lifecycle badges, image count, archived toggle, inline rename, archive/restore, image keep/discard curation, sort options (recent renders / recently created / A–Z), portfolio re-queue on `portfolio_failed`, "Open in Casting Room" cross-tab bridge.
- **Prompt Builder ↔ Actor Bank integration Phase 1-3 (P7):**
  - Phase 1: `slug` + `prompt_descriptor` shadow columns on `characters`; LLM descriptor generation via `POST /api/character-prompt-descriptor`; auto-gen on character creation (both audition and batch-save paths); slug backfill on startup; ActorDetail descriptor UI with inline edit + Generate/Regenerate.
  - Phase 2: `ActorBankPicker` component; "Import from Actor Bank" in DirectorSection; `chars` state shape now `{ g, a, actorBankId, name, promptDescriptor, thumbnailUrl }`; `actorBankMapping.js` derives g/a from Actor Bank profile; share URL v2 encodes actorBankId.
  - Phase 3: `rewriteScene` extended with `actorBankSlugs` third parameter; Character Builder entries take priority on slug collision; `actorBankSlugs` cache in App.jsx refreshed on tab focus; SceneInput @slug autocomplete dropdown.

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

Chroma is auto-spawned by `vite.config.js` on dev server start when `AUTO_START_CHROMA` is not `false`. On Windows x64, auto-start resolves a non-`node_modules` `chroma` executable (typically Python `chroma.exe` from `pip install chromadb`); override with `CHROMA_BIN`. The npm `chromadb` CLI shim does not support Windows x64. `better-sqlite3` must be rebuilt for the same Node major that runs `npm run dev` (`npm rebuild better-sqlite3`).

---

## Session Handoff (2026-05-11, evening)

**MVP acceptance complete:** Ruslan Section 13 happy path (`api/ruslanMvpAcceptance.test.js`); MVP Done gate readiness + five-scene QA + blind scoring (`api/ruslanMvpDoneGate.test.js`, `GET /api/entities/:id/mvp-done-gate`, Continuity tab `EntityContinuityQaPanel`). Extrapolation pipeline epics closed (`rsm9`, character-shaped stages S1–S6). **Location entities:** dedicated three-stage extrapolation (`api/lib/extrapolation/stages/location/`). S6 conflict UI shipped (`EntityConflictPanel`).

**Still open (start with `bd ready`):** P1 polish — anchor gallery `zpcf`, audit trail `ibfa`, CLIP embedding cache `7h8h`, user-upload override `tjao`, S2–S5 parallelization `0yie`. Migration epic `y9mw` may remain for legacy `characters` → `entities` lift workflows. P2 deferred items unblocked after MVP gate.

**Dev checks:** Stop `npm run dev`, run `npm rebuild better-sqlite3` for the Node major that runs dev, then `npm test`. On Windows, dev often uses system Node v24 while the IDE shell may default to another major — align before running Vitest. Targeted suites: `npx vitest run api/lib/continuity api/lib/extrapolation api/ruslanMvpAcceptance.test.js api/ruslanMvpDoneGate.test.js`. Confirm `GET /api/chroma-health` when vector features matter.
