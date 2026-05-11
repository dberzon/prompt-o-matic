# PROJECT CONTEXT — Qwen Prompt Builder

Qwen Prompt Builder (QPB) is a local-first tool for constructing cinematic text-to-image prompts and generating AI actor portraits via ComfyUI, running entirely on a developer machine with no cloud deployment.

For full technical detail, see `APPLICATION_REFERENCE.md`.

---

## Five Tabs

| Tab | Job |
|---|---|
| **Prompt Builder** | Assemble a prompt from scene input, director chips (61 directors), scenario templates, and optional LLM polish. Independent of the other tabs. |
| **Character Builder** | Author named character descriptions (bank entries) stored in SQLite and mirrored to localStorage. These feed Path A in the Casting Room. |
| **Casting Room** | Two paths: Path A (audition from bank entry, LLM generates profiles, ComfyUI renders) and Path B (batch generation with vector similarity screening). Shared Active Character section for portfolio management and image gallery. |
| **Actor Bank** | Full character management interface for the `characters` table. Grid with search/filter. Detail view: inline rename, archive/restore, image curation, portfolio re-queue, prompt descriptor edit/generate. Characters can be imported into Prompt Builder slots. |
| **Continuity** | Worldbuilding entity editor: extrapolation pipeline, attribute review, primary reference anchors, Stage 6 conflict resolution, and MVP Done gate (five-scene continuity QA with blind reviewer scoring). |

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

### Entity layer (`api/entities.js`, `api/entity-*`, `api/lib/db/repositories.js`)
Additive worldbuilding persistence alongside legacy `characters`: `entities`, provenance-tracked `entity_attributes`, `entity_relationships`, and `visual_anchors`. REST handlers under `/api/entities/*` support CRUD, relationship management, anchor upload, attribute promote/dismiss/edit, and S6 conflict resolve/dismiss. Prompt packs compile from entity canon + inferred/derived attributes via `POST /api/promptpack/from-entity/:id` (relationship-derived attrs use `relation.<type>:<other_slug>` keys and scope gating). Attribute writes outside tests must go through `writeAttribute`; `api/lib/db/entityAttributesProvenanceGuard.test.js` blocks direct `INSERT INTO entity_attributes` elsewhere.

### Extrapolation pipeline (`api/lib/extrapolation/`)
Six staged LLM passes turn sparse notes into entities, canon/inferred attributes, environments, visual descriptors, and conflict markers. Orchestrator: `api/lib/extrapolation/orchestrator.js` with per-stage cache (`stageCache.js`) and model routing (`modelRouting.js`). Entry points: `POST /api/extrapolate/character/:id` (full pipeline) and `POST /api/extrapolate/stage/:id/:n` or `POST /api/entities/:id/extrapolate/stage/:n`. Stage 5 reference portrait queue: `POST /api/entities/:id/extrapolate/stage/5`. Ruslan worked example fixture: `api/lib/extrapolation/fixtures/ruslanWorkedExample.js`.

| Stage | Role |
|---|---|
| S1 | Entity extraction → canon attributes + related entities |
| S2 | Historical/cultural enrichment (default low confidence) |
| S3 | Psychological inference (`behavior.*`, `speech.*`, `fear.*`) |
| S4 | Environmental projection + `provenance=derived` relationship attrs |
| S5 | Visual descriptor + primary reference anchor generation |
| S6 | Cross-stage conflict detection → suggested conflict markers |

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
| `entities` | Worldbuilding entities with type and archive state |
| `entity_attributes` | Provenance-tracked attributes per entity |
| `entity_relationships` | Typed relationships between entities |
| `visual_anchors` | Continuity anchors (reference images, seeds, etc.) |

**localStorage** is used for: custom presets, custom directors, AI engine preference, local-only flag, prompt history (max 12), Character Builder entries (mirrored from SQLite), and a few transient UI preferences. Saved prompts and workspace profiles were migrated to SQLite in P5.

---

## Runtime Modes

`APP_MODE` (from `.env.local`) controls feature gating:

- **`local-studio`** (current operative mode): All operations permitted if the corresponding `ENABLE_*` flag is set. Full SQLite, ComfyUI, vector, batch access.
- **`cloud`**: Write operations blocked for batch/ComfyUI. Only read endpoints allowed. Vector status returns stub. Intended for a Vercel deployment that only offers prompt polish — not the current use case.

Five `ENABLE_*` flags gate API domains: `ENABLE_CHARACTER_BATCH_API`, `ENABLE_PROMPT_PACK_API`, `ENABLE_COMFY_API`, `ENABLE_GENERATED_IMAGES_API`, `ENABLE_VECTOR_MAINTENANCE_API`.

---

## Architecture: No Separate Server

All API routes are Vite dev-server middleware plugins registered in `vite.config.js`. There is no Express or Fastify server. The frontend and all ~55 API routes run from a single `npm run dev` process. Rebuild `better-sqlite3` when the Node major used for `npm run dev` changes.
