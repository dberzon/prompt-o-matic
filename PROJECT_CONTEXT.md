# PROJECT CONTEXT — Qwen Prompt Builder

Qwen Prompt Builder (QPB) is a local-first tool for constructing cinematic text-to-image prompts and generating AI actor portraits via ComfyUI, running entirely on a developer machine with no cloud deployment.

For full technical detail, see `APPLICATION_REFERENCE.md`.

---

## Six-Step Workflow

The UI uses a **6-step workflow stepper** (`NavigationStepper.jsx`). Steps 5–6 are placeholders.

| Step | Label | Job |
|---|---|---|
| **1 — Casting** | Casting Pipeline, Character Builder, Actor Bank | Three sub-tabs in `CastingStepContainer.jsx`. Casting Pipeline hosts Path A/B (formerly Casting Room), Active Character, and Comfy render system. Character selection (`activeCharId`) gates progression to Step 2. |
| **2 — Bible** | Entity bible editor + visual anchors | `BibleStepContainer.jsx` — lift a bank entry to an entity via `POST /api/entities/lift-from-bank-entry`; edit canon in `src/features/bible/BibleEditor.jsx`. |
| **3 — Extrapolation** | Type-aware LLM extrapolation + continuity QA | `ExtrapolationStepContainer.jsx` — requires `activeEntityId` from Step 2. Embeds `EntityExtrapolationPanel`, `AttributeReviewPanel`, `EntityConflictPanel`, and `EntityContinuityQaPanel` (MVP Done gate). |
| **4 — Prompt Studio** | Prompt assembly, polish, Comfy preview | `PromptStudioStep.jsx` (formerly Prompt Builder). Workspace state lives in `WorkspaceContext.jsx`. Supports manual edit mode, **Polish current text**, Comfy render from displayed prompt, and A/B compare (`sessionStorage` key `qpb_compare_renders_v1`). Includes `BibleQuickRef` sidebar when an entity is active. |
| **5 — Render** | *(placeholder)* | Not yet implemented. |
| **6 — Portfolio** | *(placeholder)* | Not yet implemented. |

---

## External Services

| Service | URL | What breaks if absent |
|---|---|---|
| ComfyUI | `localhost:8188` | All image rendering fails (502) |
| Ollama or LM Studio | `localhost:11434` / configurable | Polish falls back to cloud; character generation fails if no cloud key |
| Chroma | `localhost:8000` | Similarity checks skip silently (batch dedup bypassed) |
| Anthropic Claude API | cloud | Cloud polish fails; local providers unaffected |

Chroma is auto-spawned by `vite.config.js` on dev start unless `AUTO_START_CHROMA=false`. On Windows x64, auto-start uses a Python `chroma.exe` (or `CHROMA_BIN`), not the npm `chromadb` CLI. All other services must be started manually.

---

## Key Subsystems

### Assembler (`src/utils/assembler.js`)
Builds ordered prompt fragments from scene, scenario, chips, and characters. Applies 29 REWRITES rules to scene text, then assembles in fixed cinematic order (shot → lens → scenario → scene → env → texture → comp → light → color → film → qual). Passes result through `dedupeFragments()` (3-check algorithm: exact, substring, Jaccard similarity).

### Prompt panel (`src/components/PromptOutput.jsx`)
Renders assembled/polished/manual prompt text, polish controls, Comfy queue for the **current displayed** prompt, optional A/B snapshot saves, per-slot Comfy compare results (last images kept per column, persisted in `sessionStorage` under `qpb_compare_renders_v1` for the tab), and workflow hints (`<details>`). **Polish with AI** sends full `fragments: prompt[]` plus scene/scenario/narrative beat; **Polish current text** sends `fragments: [displayText.trim()]` with scene/scenario/narrative beat cleared so the LLM focuses on refining the visible string while still receiving director register fields.

### Polish System (`api/lib/polishCore.js`)
LLM-based prompt refinement. Provider resolution chain: embedded sidecar → local (Ollama / LM Studio) → Claude cloud. System prompt enforces: 60–110 words, no abstract adjectives, static composition, passive figures, single light source, anti-CGI anchors. Controlled by `POST /api/polish`.

### Character Lifecycle (`api/lib/characterLifecycle.js`)
State machine for `characters.lifecycle_status`: `auditioned` → `portfolio_pending` → `portfolio_failed` / `ready`. Temporary `preview` status used only for batch preview renders (cleaned up after ingest). Soft-archive via `archived_at` column is separate from lifecycle.

### Batch Pipeline (`api/lib/characters/batchGeneration.js`)
Path B: LLM generates N×multiplier candidate profiles; each is embedded and checked against Chroma. Classification thresholds: ≤0.18 = rejected (too similar), ≤0.28 = needsMutation, >0.28 = accepted. Batch and candidates persisted to SQLite.

### Vector / Similarity (`api/lib/vector/`)
Chroma stores character embeddings. Used for batch deduplication and Save-to-Cast re-check. Embedding model: `nomic-embed-text` (Ollama) or `nomic-embed-text-v1.5` (LM Studio). Not triggered automatically on character creation — `embeddingStatus` starts as `not_indexed`.

### ComfyUI Integration (`api/lib/comfy/comfyService.js`)
Queues prompt packs to ComfyUI, polls job status, ingests output images into `generated_images` table. SSE endpoint (`GET /api/render-events`) broadcasts render-update events at 2-second polling interval. Frontend subscribes via `EventSource` and falls back to 20-second polling. Job state persisted in `comfy_jobs` SQLite table — survives page reloads.

### Projects and bibles (`api/routes/projects/`, `api/routes/bibles/`, `src/features/bible/`)
Multi-step workflow scaffolding: projects (`GET/POST /api/projects`, `GET /api/projects/:id`) scope workspace state. Entity bibles (`GET /api/bibles/:entityId`, snapshots, export, completeness, approve-section, extrapolate) and agent autofill (`POST /api/agents/autofill-bible`) power Step 2. Extrapolation streaming: `GET /api/extrapolation/:runId/status` and `.../stream`.

### Entity layer (`api/entities.js`, `api/entity-*`, `api/lib/db/repositories.js`)
Additive worldbuilding persistence alongside legacy `characters`: `entities`, provenance-tracked `entity_attributes`, `entity_relationships`, and `visual_anchors`. REST handlers under `/api/entities/*` support CRUD, relationship management, anchor upload, attribute promote/dismiss/edit, and S6 conflict resolve/dismiss. Prompt packs compile from entity canon + inferred/derived attributes via `POST /api/promptpack/from-entity/:id` (relationship-derived attrs use `relation.<type>:<other_slug>` keys and scope gating). Attribute writes outside tests must go through `writeAttribute`; `api/lib/db/entityAttributesProvenanceGuard.test.js` blocks direct `INSERT INTO entity_attributes` elsewhere.

### Extrapolation pipeline (`api/lib/extrapolation/`)
Staged LLM passes expand sparse notes into provenance-tracked attributes (and, for the character-shaped chain, visual descriptors and conflict markers). Chains are selected by entity `type` via `api/lib/extrapolation/stageRegistry.js` (`chainFor`). Orchestrator: `api/lib/extrapolation/orchestrator.js` with per-stage cache (`stageCache.js`) and model routing (`modelRouting.js`). Entry points: `POST /api/extrapolate/character/:id` (full pipeline for the given entity id) and `POST /api/extrapolate/stage/:id/:n` or `POST /api/entities/:id/extrapolate/stage/:n` (only stage ids that exist on that entity’s chain are valid). Stage 5 reference portrait queue (character-shaped entities only): `POST /api/entities/:id/extrapolate/stage/5`. Ruslan worked example fixture: `api/lib/extrapolation/fixtures/ruslanWorkedExample.js`.

**Character-shaped types** (`character`, `environment`, `prop`, `institution`): six stages as below.

| Stage | Role |
|---|---|
| S1 | Entity extraction → canon attributes + related entities |
| S2 | Historical/cultural enrichment (default low confidence) |
| S3 | Psychological inference (`behavior.*`, `speech.*`, `fear.*`) |
| S4 | Environmental projection + `provenance=derived` relationship attrs |
| S5 | Visual descriptor + primary reference anchor generation |
| S6 | Cross-stage conflict detection → suggested conflict markers |

**`location`:** three stages — (1) geography, (2) inhabitants, (3) history — implemented under `api/lib/extrapolation/stages/location/` with prompts `location.geography`, `location.inhabitants`, `location.history`.

**`era`:** placeholder chain (stages 1–6 no-op) until a dedicated pipeline is implemented.

### Continuity QA and MVP Done gate (`api/lib/continuity/`)
Section 4 acceptance: one character plus environment context, five scene generations, reviewer scores ≥4/5 on face/body/wardrobe (blind to seed). Readiness: `GET /api/entities/:id/mvp-done-gate`. Queue scenes: `POST /api/entities/:id/continuity-qa/generate` (requires readiness). Scoring: `GET/POST /api/entities/:id/continuity-qa/scoring-sheet|scores`. CLI: `scripts/run-continuity-qa-generations.mjs`. Automated harness: `api/ruslanMvpAcceptance.test.js`, `api/ruslanMvpDoneGate.test.js`.

### IPAdapter / continuity strategy (`api/lib/comfy/ipadapterFeasibility.js`)
Qwen-Image DiT templates do not ship a validated IPAdapter node chain. MVP decision: continue reference-image conditioning via workflow mapping hooks (`buildComfyPromptPayload` injects primary `reference_image` anchor when present). Per-character LoRA remains a follow-up if continuity QA scores miss threshold.

---

## Data Layer

**SQLite** (`better-sqlite3`, `api/lib/db/`) is the canonical data store. 14 tables:

| Table | What it holds |
|---|---|
| `characters` | Generated character profiles with lifecycle and archive state |
| `character_bank_entries` | Character descriptions from Character Builder |
| `prompt_packs` | Compiled prompt packs per character per view angle |
| `generated_images` | ComfyUI output images with approve/reject state |
| `character_batches` | Path B batch sessions |
| `character_batch_candidates` | Individual batch candidates with review state |
| `actor_candidates` | Actor candidate records |
| `actor_auditions` | Audition records linking candidates to bank entries |
| `saved_prompts` | Named prompt snapshots (migrated from localStorage) |
| `workspace_profiles` | Named workspace state snapshots (migrated from localStorage) |
| `comfy_jobs` (migration 6) | Persistent ComfyUI job tracking |
| `entities` | Worldbuilding entities with `type` (`character`, `environment`, `prop`, `institution`, `location`, `era`) and archive state |
| `entity_attributes` | Provenance-tracked attributes per entity |
| `entity_relationships` | Typed relationships between entities |
| `visual_anchors` | Continuity anchors (reference images, seeds, etc.) |

**localStorage** is used for: custom presets, custom directors, AI engine preference, local-only flag, prompt history (max 12), Character Builder entries (mirrored from SQLite), and a few transient UI preferences. Saved prompts and workspace profiles were migrated to SQLite in P5. **sessionStorage** (`qpb_compare_renders_v1`) stores the last successful Comfy compare images for Prompt Builder snapshot slots A/B within a browser tab.

---

## Runtime Modes

`APP_MODE` (from `.env.local`) controls feature gating:

- **`local-studio`** (current operative mode): All operations permitted if the corresponding `ENABLE_*` flag is set. Full SQLite, ComfyUI, vector, batch access.
- **`cloud`**: Write operations blocked for batch/ComfyUI. Only read endpoints allowed. Vector status returns stub. Intended for a Vercel deployment that only offers prompt polish — not the current use case.

Five `ENABLE_*` flags gate API domains: `ENABLE_CHARACTER_BATCH_API`, `ENABLE_PROMPT_PACK_API`, `ENABLE_COMFY_API`, `ENABLE_GENERATED_IMAGES_API`, `ENABLE_VECTOR_MAINTENANCE_API`.

---

## Architecture: No Separate Server

All API routes are Vite dev-server middleware plugins registered in `vite.config.js`, plus auto-discovered handlers under `api/routes/**/*.route.js` via `qpbDevServer`. There is no Express or Fastify server. The frontend and all **~75+** API routes run from a single `npm run dev` process. Rebuild `better-sqlite3` when the Node major used for `npm run dev` changes.
