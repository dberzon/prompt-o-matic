# Qwen Prompt Builder

Cinematic prompt builder for [Qwen image generation](https://chat.qwen.ai). Director-register interaction scenarios, technical parameter chips, and scene assembly for photorealistic, non-CGI outputs in the aesthetic register of Tarkovsky, Kubrick, Lynch, Jarmusch, and 56 other directors.

## Documentation

- Technical developer handoff: [docs/TECHNICAL.md](docs/TECHNICAL.md)
- Project context and flow: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [docs/TAKEOVER_FLOW.md](docs/TAKEOVER_FLOW.md)
- Debugging and dev panel: [docs/DEBUGGING.md](docs/DEBUGGING.md)

## Features

- **61 directors** — each with unique interaction scenarios for 1, 2, or 3 characters
- **Character engine** — configurable gender + age, scenarios auto-rewrite with your characters
- **Scene description** — plain-language input automatically expanded into cinematic material language
- **Technical chips** — shot, lens, environment, texture, light, palette, film stock, qualifiers
- **Live assembly** — prompt builds in real-time, copy with one click
- **Presets** — Tarkovsky, Kubrick, Jarmusch, Mann night, Winter, Night noir
- **Pluggable AI engine** — Cloud, Local Ollama, or Auto fallback

## Application tabs

| Tab | What it does |
|---|---|
| **Prompt Builder** | Assemble cinematic text-to-image prompts from director chips, scenario templates, and scene input. Optional LLM polish via Ollama, LM Studio, or Claude. |
| **Character Builder** | Define named character bank entries with descriptions. These entries feed into the Casting Room's Path A (audition) workflow. |
| **Casting Room** | Generate AI actor portraits through two paths: Path A (cast from a bank brief via LLM + ComfyUI) and Path B (batch-generate diverse candidates with vector similarity screening). Manage the active character's portfolio and image gallery. |
| **Actor Bank** | Browse all saved characters with search, gender, and age filters. Read-oriented; all write actions happen in the Casting Room. |

**Dependency chain:** Character Builder → Casting Room → Actor Bank. Prompt Builder is independent.

## AI engine setup

The polish endpoint supports four modes plus a strict toggle:

- `Auto` (default): prefers embedded if available, then local provider, otherwise cloud
- `Embedded`: uses the built-in Tauri sidecar (`llama-server`) with local GGUF model
- `Local (Ollama)`: forces local generation on your machine
- `Cloud`: forces cloud generation
- `Local only` toggle: disables cloud fallback entirely (fails fast if local is unavailable)

### Embedded desktop quick start (no Ollama required)

1. Run desktop shell in dev:

```bash
npm install
npm run tauri:dev
```

2. Open **Model...** in the top settings bar.
3. Choose `Qwen2.5 3B Instruct Q4_K_M`.
4. Click **Download model** and wait for checksum verification.
5. Click **Start sidecar**.
6. Set engine to `AI: Embedded`.
7. Use **Polish with AI** normally.

If embedded sidecar is not running, health status will show setup guidance.

### Local Ollama quick start

1. Install [Ollama](https://ollama.com/download)
2. Pull a supported model:

```bash
ollama pull qwen2.5:7b-instruct
```

3. (Optional) override defaults in `.env.local`:

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
OLLAMA_TIMEOUT_MS=45000
```

4. Start the app and choose AI settings in the top profile/settings bar:
   - `AI: Auto`, `AI: Local`, or `AI: Cloud`
   - optional `Local only` checkbox for strict privacy mode

If Ollama is unavailable in `Auto`, the app falls back to cloud automatically unless `Local only` is enabled.

## How to use local mode

1. Open the app.
2. In the profile/settings bar, set `AI: Local` (or `AI: Auto`).
3. Keep `Local only` OFF if you want automatic cloud fallback.
4. Turn `Local only` ON if you want strict no-cloud behavior.
5. Click **Polish with AI** as usual.

You will see status hints near the prompt output:
- local model ready
- local model missing (`ollama pull qwen2.5:7b-instruct`)
- embedded runtime loading/ready
- fallback to cloud
- local-only active (cloud disabled)

## Desktop build and release

- Local desktop build:

```bash
npm run preflight:embedded
npm run tauri:build
```

- CI desktop release pipeline:
  - `.github/workflows/desktop-release.yml`
  - signs updater artifacts using `TAURI_SIGNING_PRIVATE_KEY` secrets.

- Sidecar binaries:
  - place platform binaries in `src-tauri/bin/`
  - pin checksums in `src-tauri/bin/CHECKSUMS.txt`.
  - `npm run preflight:embedded` fails if placeholders are still present.

## First-time user guide

Use this 60-second flow the first time you open the app:

1. **Set your characters**  
   Choose how many characters you want (1/2/3), then set age and gender for each.
2. **Describe the scene in plain language**  
   Write what is happening, where it happens, and the mood you want.
3. **Pick a director**  
   Select one director style to generate interaction scenarios matching your characters.
4. **Select one scenario**  
   Choose the interaction that best fits your idea (this becomes the narrative core).
5. **Tune technical chips**  
   Add shot, lens, lighting, texture, palette, and film stock chips to shape the visual output.
6. **Use presets for speed (optional)**  
   Apply a preset as a starting point, then adjust chips as needed.
7. **Copy and run**  
   Copy the assembled prompt and paste it into Qwen image generation.

### Practical tips for smoother results

- Start simple: choose fewer chips, generate once, then iterate.
- Keep scene text concrete (subjects, action, place, time, weather, mood).
- Avoid contradictory choices (for example, harsh noon sun + deep night noir palette).
- If output feels synthetic, add texture/film stock chips and reduce overly stylized combinations.

## Quick deploy to Vercel

### Required environment variable

Set `ANTHROPIC_API_KEY` in your Vercel project settings → Environment Variables. This is needed for the AI polish endpoint (`/api/polish`) to call Claude. All other features (ComfyUI, character batch, vector) are local-studio only and are automatically disabled in cloud mode via `APP_MODE=cloud` (set in `vercel.json`).

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
vercel
```

Follow the prompts. Set `ANTHROPIC_API_KEY` when asked for environment variables, or add it in the Vercel dashboard after deploy.

### Option B — GitHub → Vercel UI

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Under Environment Variables, add `ANTHROPIC_API_KEY`
5. Click Deploy

### Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

For cloud mode in local dev, set `ANTHROPIC_API_KEY` in `.env.local`.

### Local canonical SQLite storage (Phase 3A)

- Canonical local storage uses SQLite via `better-sqlite3`.
- DB path is controlled by `SQLITE_DB_PATH` (default: `./data/qpb-local.sqlite`).
- This storage is intended for `APP_MODE=local-studio`.
- In `APP_MODE=cloud`, SQLite initialization is blocked intentionally.
- On Vercel serverless deployments, local SQLite file persistence is not reliable across invocations.

### Chroma semantic index + embeddings (Phase 3B.1)

- SQLite remains the canonical source of truth.
- Chroma is a rebuildable semantic index for similarity search.
- Current scope is infrastructure only (no automatic background indexing yet).

Local env vars:

```bash
ENABLE_VECTOR_MAINTENANCE_API=true
APP_MODE=local-studio
CHROMA_URL=http://127.0.0.1:8000
CHROMA_COLLECTION_CHARACTERS=characters
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=45000
```

Run Chroma locally (Docker):

```bash
docker run --rm -p 8000:8000 chromadb/chroma:latest
```

Optional integration tests against a real Chroma server:

```bash
RUN_CHROMA_INTEGRATION_TESTS=true npm test
```

Manual vector maintenance API (Phase 3B.2):

- `GET /api/vector-status`
- `POST /api/vector-index-character` with `{ "id": "character_id" }`
- `POST /api/vector-reindex-characters` with optional filters:
  - `{ "limit": 50, "embeddingStatus": "not_indexed", "projectId": "proj_1" }`
- `POST /api/vector-similar-by-character` with `{ "id": "character_id", "limit": 5 }`
- `POST /api/vector-similar-by-text` with `{ "text": "query text", "limit": 5 }`

These endpoints are maintenance tooling only. SQLite is canonical; Chroma is a semantic index that can be rebuilt from canonical records.

Safety rules:

- `ENABLE_VECTOR_MAINTENANCE_API=true` is required for all vector maintenance endpoints.
- In `APP_MODE=cloud`, maintenance/write operations are blocked:
  - blocked: `vector-index-character`, `vector-reindex-characters`, `vector-similar-by-character`, `vector-similar-by-text`
  - allowed when enabled: `vector-status` (with SQLite path redacted)

### Batch character generation API (Phase 4A)

Backend-only service endpoint:

- `POST /api/characters-generate-batch`

Example request:

```json
{
  "request": {
    "count": 30,
    "ageMin": 20,
    "ageMax": 28,
    "genderPresentation": "female",
    "projectTone": "cinematic audition casting",
    "diversityRequirements": ["unique faces", "different hairstyles"],
    "outputViews": ["front_portrait", "three_quarter_portrait", "profile_portrait"],
    "candidateMultiplier": 2
  },
  "options": {
    "saveAccepted": false,
    "checkSimilarity": true,
    "mutateSimilar": false,
    "similarityLimit": 5,
    "maxCandidates": 60
  },
  "provider": {
    "engine": "local",
    "localProvider": "lmstudio",
    "model": "qwen-local"
  }
}
```

Notes:

- This endpoint is service-layer only (no UI in this phase).
- `saveAccepted: true` stores accepted characters in SQLite with `embeddingStatus: not_indexed`.
- No automatic indexing or background jobs in this phase.

### Batch review session API (Phase 4B)

Phase 4B adds persistent batch review sessions so generated candidates can be reviewed over time before saving to canonical characters.

Enable batch API endpoints:

```bash
ENABLE_CHARACTER_BATCH_API=true
```

Cloud-mode safety:

- In `APP_MODE=cloud`, read endpoints are allowed when enabled.
- Write/mutation/save operations are blocked by default.

New endpoints:

- `GET /api/character-batches`
- `GET /api/character-batch?id=batch_id`
- `GET /api/character-batch-candidates?batchId=batch_id`
- `POST /api/character-batch-candidate-approve`
- `POST /api/character-batch-candidate-reject`
- `POST /api/character-batch-candidate-save`
- `POST /api/character-batch-candidate-mutate`
- `POST /api/character-batch-refill`

Generate and persist batch in one call:

```json
{
  "request": { "count": 30, "ageMin": 20, "ageMax": 28, "outputViews": ["front_portrait"], "candidateMultiplier": 2 },
  "options": { "persistBatch": true, "saveAccepted": false, "checkSimilarity": true, "mutateSimilar": false }
}
```

This remains pre-UI and pre-ComfyUI; it is backend workflow infrastructure only.

Suggested workflow:

1. Generate and persist batch (`persistBatch: true`).
2. Review candidates through list/read endpoints.
3. Mutate weak candidates (`character-batch-candidate-mutate`) when needed.
4. Refill batch (`character-batch-refill`) until target pool quality/size is reached.
5. Approve and save candidates to canonical `characters`.

Still not included in this phase:

- UI review panels
- prompt-pack compiler
- ComfyUI/image generation
- automatic/background vector indexing

### Qwen prompt-pack compiler API (Phase 5)

Phase 5 converts `CharacterProfile` records into reusable `QwenImagePromptPack` records for later generation pipelines.

Enable prompt-pack API:

```bash
ENABLE_PROMPT_PACK_API=true
```

Cloud safety:

- In `APP_MODE=cloud`, compile/write operations are blocked.
- Read listing (`GET /api/prompt-packs`) can be allowed when the flag is enabled.

Endpoints:

- `POST /api/prompt-pack-compile-character`
- `POST /api/prompt-pack-compile-batch`
- `GET /api/prompt-packs?characterId=char_123`

Example compile-character:

```json
{
  "characterId": "char_123",
  "views": ["front_portrait", "three_quarter_portrait", "profile_portrait", "full_body", "audition_still"],
  "options": {
    "persist": true,
    "aspectRatio": "2:3",
    "styleProfile": "cinematic casting portrait",
    "includeNegativePrompt": true
  }
}
```

Example compile-batch:

```json
{
  "batchId": "batch_123",
  "candidateStatus": "saved",
  "views": ["front_portrait", "three_quarter_portrait", "profile_portrait"],
  "options": {
    "persist": true,
    "aspectRatio": "2:3",
    "styleProfile": "cinematic casting portrait",
    "includeNegativePrompt": true
  }
}
```

This phase does not generate images yet. ComfyUI queue/inference integration comes afterward.

### ComfyUI queue integration API (Phase 6A)

Phase 6A connects persisted prompt packs to ComfyUI queue/status/history APIs and allows manual output metadata ingestion into canonical `generated_images`.

Required env:

```bash
ENABLE_COMFY_API=true
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_TIMEOUT_MS=45000
COMFYUI_DEFAULT_WORKFLOW_ID=qwen-image-2512-default
ENABLE_CHARACTER_BATCH_API=true
ENABLE_PROMPT_PACK_API=true
ENABLE_GENERATED_IMAGES_API=true
# Optional for manual vector maintenance routes only:
# ENABLE_VECTOR_MAINTENANCE_API=true
```

Endpoints:

- `GET /api/comfy-status`
- `GET /api/comfy-workflows`
- `POST /api/comfy-validate-workflow`
- `POST /api/comfy-queue-prompt-pack`
- `POST /api/comfy-queue-character`
- `GET /api/comfy-job-status?id=<promptId>`
- `POST /api/comfy-ingest-outputs`
- `POST /api/comfy-jobs-status`
- `POST /api/comfy-ingest-many`
- `GET /api/generated-images`
- `POST /api/generated-image-approve`
- `POST /api/generated-image-reject`
- `GET /api/generated-image-view?id=<generatedImageId>`
- `POST /api/character-portfolio-plan`
- `POST /api/character-portfolio-queue`

Example queue prompt-pack request:

```json
{
  "promptPackId": "pack_123",
  "workflowId": "qwen-image-2512-default",
  "dryRun": true
}
```

Example response:

```json
{
  "ok": true,
  "promptPackId": "pack_123",
  "promptId": "abc123",
  "workflowId": "qwen-image-2512-default",
  "seed": 123456789
}
```

Notes:

- This phase is backend only (no UI panel/poller yet).
- No automatic background queue scheduler.
- No advanced ControlNet/IP-Adapter workflow integration yet.
- No image embeddings yet.

Workflow calibration (real Comfy export):

1. In ComfyUI, export your workflow in API JSON format.
2. Save it as a new template file under:
   - `api/lib/comfy/workflows/<your-workflow-id>.json`
3. Create matching mapping file:
   - `api/lib/comfy/workflows/<your-workflow-id>.mapping.json`
4. In mapping JSON, define required fields:
   - `positivePrompt`, `negativePrompt`, `seed`, `width`, `height`
   - optional: `modelName`, `batchSize`
5. Validate mapping and template:

```json
POST /api/comfy-validate-workflow
{
  "workflowId": "qwen-image-2512-default"
}
```

6. Run dry-run queue injection (no Comfy call):

```json
POST /api/comfy-queue-prompt-pack
{
  "promptPackId": "pack_123",
  "workflowId": "qwen-image-2512-default",
  "dryRun": true
}
```

7. If dry-run output looks correct, remove `dryRun` and queue for real.

Queue workflow safety rules:

- For queue endpoints (`/api/comfy-queue-prompt-pack`, `/api/comfy-queue-character`):
  - If `workflowId` is omitted, default workflow is used.
  - If `workflowId` is provided and unknown, request fails with `400`.
  - To explicitly allow fallback on unknown ID, pass `allowWorkflowFallback: true`.
- Dry-run follows the same strict behavior.
- Use `GET /api/comfy-workflows` to discover exact valid `workflowId` values before real queue calls.

Workflow discovery:

- Drop-in workflow files are auto-discovered by filename pair:
  - `<workflowId>.json`
  - `<workflowId>.mapping.json`
- List discovered workflows:

```http
GET /api/comfy-workflows
```

- If one side of the pair is missing, discovery reports:
  - `hasTemplate` / `hasMapping`
  - `valid: false`
  - clear `errors` messages
- Diagnostic responses include workflow resolution fields:
  - `requestedWorkflowId`
  - `resolvedWorkflowId`
  - `usedFallback`

Embedded runtime phase notes are tracked in `docs/embedded-runtime-spike.md`.

### Minimal Operator Pipeline UI (Phase 6B)

Use the `Pipeline` tab for manual operator flow (no auto polling/background jobs yet):

1. Load/select a batch.
2. Approve/reject/save candidates.
3. Select a saved character ID.
4. Compile and list prompt packs.
5. Select a valid Comfy workflow from `/api/comfy-workflows`.
6. Dry-run a selected prompt pack.
7. Queue real generation.
8. Manually check job status.
9. Manually ingest outputs.

Notes:

- Workflow selector hides invalid workflows by default.
- `403` errors in panel usually indicate missing `ENABLE_*` env flags.
- Queue actions require both `promptPackId` and selected `workflowId`.

### Persisted Generated Image Gallery (Phase 6D)

The Pipeline tab now includes a minimal persisted gallery section backed by canonical `generated_images`.

- List generated images:
  - `GET /api/generated-images?characterId=...&promptPackId=...&viewType=...&approved=true|false&limit=20`
- Review controls:
  - `POST /api/generated-image-approve` with `{ "id": "<generatedImageId>" }`
  - `POST /api/generated-image-reject` with `{ "id": "<generatedImageId>", "rejectedReason": "optional reason" }`
- Image preview proxy (ID-based):
  - `GET /api/generated-image-view?id=<generatedImageId>`

Manual gallery workflow:

1. Queue and ingest images as before.
2. In Pipeline tab, use Generated Images / Gallery.
3. Refresh by selected prompt pack or selected character.
4. Review preview + metadata.
5. Approve or reject image records.

Cloud safety:

- With `APP_MODE=cloud`, metadata list can be allowed, but preview proxy and approve/reject writes are blocked.

### Controlled Character Portfolio Generation (Phase 7A)

Use the Pipeline tab Character Portfolio section for a manual multi-view portfolio flow:

1. Select saved character ID.
2. Select workflow.
3. Select desired views (front, 3/4, profile, full body, audition still, optional cinematic scene).
4. Click `Build Portfolio Plan`.
5. Click `Queue Portfolio`.

Backend endpoints:

- `POST /api/character-portfolio-plan`
  - resolves/reuses prompt packs for requested views
- `POST /api/character-portfolio-queue`
  - resolves prompt packs and queues each view to Comfy
  - returns partial results if some views fail

Prompt-pack reuse criteria:

- same character
- requested view exists in `consistencyTags`
- `comfyWorkflowId` matches requested workflow (if provided)
- `aspectRatio` matches requested option

Notes:

- Queueing is synchronous/manual in this phase.
- Job status, ingest, and gallery review remain manual controls.
- No automatic polling/background jobs in this phase.

### Portfolio Multi-Job Status + Multi-Ingest (Phase 7B)

After queueing a multi-view portfolio, use bulk endpoints:

- `POST /api/comfy-jobs-status`
  - input: `{ "jobs": [{ "promptId": "...", "promptPackId": "...", "view": "front_portrait" }] }`
  - output: per-item status with summary (`success`, `failed`, `running`, `unknown`)
- `POST /api/comfy-ingest-many`
  - input: `{ "jobs": [{ "promptId": "...", "promptPackId": "...", "characterId": "...", "workflowVersion": "...", "viewType": "front_portrait" }] }`
  - output: partial-result ingest summary (successes and failures per item)

Manual portfolio workflow now:

1. Queue portfolio.
2. Check portfolio status (bulk).
3. Ingest completed portfolio outputs (bulk).
4. Review ingested images in gallery.

### Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

## Project structure

```
src/
├── data/
│   ├── directors.js   — 61 directors, scenarios for 1/2/3 characters
│   ├── chips.js       — all chip groups + negative prompt
│   ├── constants.js   — rewrites, defaults, presets
│   ├── sceneBank.js   — director scene-bank entries (style keys, hints)
│   └── sceneDeck.js   — curated scene starting points
├── utils/
│   ├── assembler.js       — prompt assembly, scene rewriter, char descriptors
│   ├── promptRules.js     — rule validation + auto-fix suggestions
│   ├── variants.js        — generates prompt variants
│   ├── qualityScore.js    — heuristic prompt quality score
│   ├── sceneScaffold.js   — scaffold generator for scene composition
│   ├── sceneSearch.js     — scene-bank search/match
│   ├── slugify.js         — snake_case slugs + collision suffix for @-tokens
│   └── downloadPromptFile.js — export prompt as .txt
├── hooks/
│   ├── usePolish.js              — /api/polish request + dev debug capture
│   ├── useCharacterOptimize.js   — /api/optimize-character flow
│   └── useWorkspaceHistory.js    — undo/redo + recent prompts
├── lib/
│   ├── api/                  — typed client wrappers for /api/* routes
│   └── embeddedRuntime.js    — Tauri sidecar bridge
├── components/
│   ├── Header.jsx
│   ├── SceneInput.jsx
│   ├── SceneScaffold.jsx
│   ├── SceneDeck.jsx
│   ├── SceneMatcher.jsx
│   ├── DirectorSection.jsx
│   ├── ChipSection.jsx
│   ├── PromptOutput.jsx
│   ├── ReferenceBoard.jsx
│   ├── CommandPalette.jsx
│   ├── BatchExplorer.jsx
│   ├── EmbeddedSetup.jsx
│   ├── CharacterBuilder.jsx        — Character Builder tab
│   └── CastingPipelinePanel.jsx    — Casting Room tab (operator pipeline)
├── App.jsx
└── index.css

api/
├── *.js               — serverless route handlers
└── lib/               — domain logic (polish, characters, prompts, comfy,
                        portfolio, generatedImages, vector, db, llm/providers)
```

The app exposes four tabs in `App.jsx`: **Prompt Builder**, **Character Builder**, **Casting Room** (operator pipeline panel), **Actor Bank** (character library browser).

## Extending

### Add a director

Add an entry to `src/data/directors.js` following the existing pattern:

```js
yourDirector: {
  name: 'Full Name',
  short: 'ShortName',        // shown in the chip grid (keep under ~10 chars)
  note: 'One-line aesthetic signature.',
  s: {
    1: c => ['scenario with ${c[0]}', ...],
    2: c => ['scenario with ${c[0]} and ${c[1]}', ...],
    3: c => ['scenario with ${c[0]}, ${c[1]}, ${c[2]}', ...],
  },
}
```

Then add the key to `DIRECTOR_LIST` at the bottom of the file (or it's auto-generated from `Object.keys`).

### Add chip groups

Add an entry to `CHIP_GROUPS` in `src/data/chips.js`.

### Add presets

Add an entry to `PRESETS` in `src/data/constants.js`.

## License

MIT
