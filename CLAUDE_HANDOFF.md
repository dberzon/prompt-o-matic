# Claude Code Handoff — Prompt-o-matic

## 1) Project Purpose

Prompt-o-matic (Qwen Prompt Builder) turns natural language scene intent into structured cinematic prompts for Qwen Image workflows. It combines:
- frontend prompt assembly (director/scenario/chips/characters),
- optional LLM polish,
- output tooling (variants/export/history) for repeatable prompt iteration.

Primary goal during takeover: improve observability and reliability without destabilizing existing generate/polish behavior.

## 2) Current Architecture

Three layers:
- **Frontend (React + Vite)**: user controls, assembly preview, polish trigger/UI.
- **API layer (Node)**: `/api/polish`, `/api/polish-health`.
- **Domain core**: polish logic and provider resolution.

Key files:
- Frontend orchestration: `src/App.jsx`
- Prompt assembly: `src/utils/assembler.js`
- Output/polish UI: `src/components/PromptOutput.jsx`
- Polish API hook: `src/hooks/usePolish.js`
- API entry: `api/polish.js`
- Core polish logic: `api/lib/polish/polishCore.js`
- Providers: `api/lib/llm/providers/*`

## 3) Core Generate/Polish Flow

1. User configures scene/scenario/chips/characters/director in frontend.
2. `App.jsx` assembles base fragments via `assemblePrompt(...)`.
3. `PromptOutput.jsx` renders assembled output.
4. User triggers polish.
5. `usePolish.js` builds payload and (normally) POSTs to `/api/polish`.
6. API delegates to `runPolish()` and `polishCore`.
7. Provider resolution selects embedded/local/cloud path.
8. Response returns; frontend updates state and display priority:
   - restored -> variant -> polished -> assembled fallback.

## 4) Recently Added Takeover/Debug Features

Frontend-only observability was added without backend/provider edits:
- **Dev-only Developer debug panel** in `PromptOutput` (visible only in dev mode).
- Debug data capture in `usePolish`:
  - `debug.lastRequest`
  - `debug.lastResponse` (provider/fallback when available)
  - `debug.lastError`
- **Copy debug JSON** action in debug panel for bug reports.
- **Dry Run mode**:
  - Dev-only toggle: `Dry Run (no API call)`.
  - Builds exact `/api/polish` payload but skips fetch.
  - Sets state to `dry-run`.
  - Stores payload in `debug.lastRequest`.
  - Shows `DRY RUN MODE ACTIVE` and payload preview.

## 5) Safe Modification Zones

Preferred early-change areas:
- `src/components/PromptOutput.jsx` (diagnostics/UI)
- `src/hooks/usePolish.js` (frontend request handling/observability)
- `src/utils/assembler.js` (small prompt assembly refinements)
- docs and tests

Guidance: keep edits minimal, isolated, and reversible.

## 6) Dangerous Zones

Avoid high-risk changes unless explicitly required:
- `api/lib/polish/polishCore.js`
- `api/lib/llm/providers/*`
- provider resolution logic
- async API pipeline behavior
- Tauri sidecar / embedded runtime orchestration
- ComfyUI integration
- database/vector systems

## 7) Current Test/Build Status

Latest takeover/debug changes were validated successfully:
- `npm test` passed
- `npm run build` passed

## 8) Recommended First Claude Code Tasks

1. Add targeted tests for `usePolish` state transitions, including `dry-run`.
2. Add small UX polish in debug panel (clear labels, no behavior changes).
3. Standardize debug field naming/output shape for easier issue triage.
4. Improve docs/examples in `docs/DEBUGGING.md` and keep `docs/BACKLOG.md` updated.
5. Investigate whether provider/fallback metadata can be exposed more consistently (design-only first; no contract change without approval).

## 9) Working Rules (Must Follow)

- **Do not rewrite architecture.**
- **Work in small, surgical patches.**
- **Do not change backend/provider behavior unless explicitly requested.**
- **Do not touch Tauri/ComfyUI/database/vector systems for routine tasks.**
- **After every substantive change, run:**
  - `npm test`
  - `npm run build`
- Report:
  - changed files,
  - behavior impact,
  - test/build results,
  - risks/follow-up.
