# Qwen Prompt Builder - Technical Documentation

Version: 1.0.0  
Audience: developers reviewing, validating, or extending the application.

## 1) Purpose and Scope

Qwen Prompt Builder is a cinematic prompt authoring app with optional local-studio generation workflows. It combines:

- A React/Vite UI for prompt composition and operator flows.
- A Node-based API layer for polish, character workflows, prompt-pack compilation, ComfyUI queue/ingest, generated image review, and vector maintenance.
- Optional Tauri desktop packaging with an embedded local inference sidecar.

This document focuses on architecture, module boundaries, runtime behavior, and validation points.

## 2) High-Level Architecture

Core runtime pieces:

1. Client UI (`src/`): React application, stateful prompt builder and pipeline panel.
2. API handlers (`api/*.js`): serverless-style route entrypoints.
3. Domain logic (`api/lib/`): business logic and infrastructure adapters.
4. Persistence:
   - Canonical records in SQLite (`better-sqlite3`).
   - Rebuildable semantic index in Chroma.
5. External systems:
   - LLM providers (cloud/local/embedded routing).
   - ComfyUI queue/history/view APIs.
   - Ollama for local text generation and embeddings.

### Dev vs Production Routing

- Development: `vite.config.js` mounts `/api/*` middleware in the Vite dev server.
- Production/serverless: each file in `api/` exports a handler for `/api/<name>`.

When adding endpoints, keep behavior aligned across both paths.

## 3) Technology Stack

- Frontend: React 18, Vite 5
- Desktop shell: Tauri 2
- Runtime API validation/domain utilities: Zod and custom guards
- Storage: SQLite (`better-sqlite3`)
- Vector index: Chroma (`chromadb` client)
- Testing: Vitest

## 4) Repository Map (Key Paths)

- `src/App.jsx` - main app shell and top-level orchestration
- `src/components/` - UI modules (builder + pipeline/operator surfaces)
- `src/data/` - directors, chips, constants, scene bank
- `src/utils/` - prompt assembly, rule validation/fixing, variants
- `src/lib/api/` - client-side API wrappers
- `api/*.js` - API route handlers
- `api/lib/` - reusable service/domain code
- `api/lib/db/schema.js` - SQLite DDL
- `api/lib/comfy/workflows/` - Comfy workflow templates and mapping files
- `src-tauri/` - desktop runtime, sidecar support, packaging config

## 5) Runtime Modes and Gating

Environment controls are used to gate operations safely.

### `APP_MODE`

- `local-studio` (default): full local workflow expected.
- `cloud`: safety mode that blocks sensitive/local-only mutation operations.

### Feature flags (representative)

- `ENABLE_CHARACTER_BATCH_API`
- `ENABLE_PROMPT_PACK_API`
- `ENABLE_COMFY_API`
- `ENABLE_GENERATED_IMAGES_API`
- `ENABLE_VECTOR_MAINTENANCE_API`

Most guarded operations use `assert*OperationAllowed(...)` helpers in `api/lib/*/access.js`.

## 6) Data Model (SQLite)

Defined in `api/lib/db/schema.js`.

Primary tables:

- `characters`
- `prompt_packs`
- `generated_images`
- `character_batches`
- `character_batch_candidates`

Design intent:

- SQLite is the canonical source of truth.
- Chroma stores derived embeddings/search state and can be rebuilt.

## 7) API Domains

Major route groups:

- Polish and health
  - `POST /api/polish`
  - `GET /api/polish-health`
- Character generation/review pipelines
  - `POST /api/characters-generate-batch`
  - `GET/POST /api/character-batches*`, `/api/character-batch*`
- Prompt-pack compiler
  - `POST /api/prompt-pack-compile-character`
  - `POST /api/prompt-pack-compile-batch`
  - `GET /api/prompt-packs`
- Comfy integration
  - Status/workflow discovery/validation
  - Queue single or multi-view jobs
  - Job status polling and output ingestion
- Generated image review
  - List/approve/reject/view proxy
- Vector maintenance
  - Status/index/reindex/similarity routes

For exact payloads and phased behavior, see `README.md`.

## 8) Frontend Behavior Notes

- Prompt builder state and profile/preset preferences rely heavily on `localStorage`.
- `src/App.jsx` coordinates:
  - scene + director + chips assembly,
  - rule validation and fix-ups,
  - workspace history,
  - operator pipeline panel access.
- Pipeline/operator flows are exposed through UI components such as `CastingPipelinePanel.jsx`.

## 9) Comfy Workflow Mapping

Comfy workflows are discovered via file pairs:

- `<workflowId>.json` (template)
- `<workflowId>.mapping.json` (node-field mapping)

Validation endpoint:

- `POST /api/comfy-validate-workflow`

Discovery endpoint:

- `GET /api/comfy-workflows`

## 10) Build, Test, and Run

- Local dev:
  - `npm install`
  - `npm run dev`
- Test:
  - `npm test`
- Production web build:
  - `npm run build`
  - `npm run preview`
- Desktop:
  - `npm run tauri:dev`
  - `npm run tauri:build` (runs embedded preflight first)

## 11) Validation Checklist (for Reviewer)

Suggested validation sequence:

1. Start app locally and confirm prompt builder baseline works.
2. Verify `/api/polish-health` returns expected engine status.
3. Run tests and inspect failing domains first (`api/lib/*/*.test.js`).
4. Validate at least one vertical operator flow end-to-end:
   - batch generation -> prompt-pack compile -> queue -> status -> ingest -> gallery review.
5. Confirm env gating:
   - operation blocked when feature flag is off,
   - expected restrictions in `APP_MODE=cloud`.

## 12) Security and Operational Notes

- Treat cloud API keys and local provider endpoints as environment-only secrets.
- Comfy proxy view endpoint depends on trusted internal Comfy host configuration.
- Current design is optimized for local operator workflows; hard multi-tenant/public deployment requires additional auth and persistence hardening.

## 13) Extension Points

Common extension areas:

- Add directors: `src/data/directors.js`
- Add chip groups: `src/data/chips.js`
- Add presets: `src/data/constants.js`
- Add API domains: `api/` + `api/lib/`
- Add Comfy workflows: `api/lib/comfy/workflows/`

## 14) Known Technical Risks

- API behavior exists in two routing surfaces (Vite middleware + serverless handlers), which can drift if not updated together.
- Serverless SQLite persistence is not suitable for robust shared-cloud state.
- Several advanced flows are intentionally manual (operator-driven polling/ingest) rather than background-scheduled.

