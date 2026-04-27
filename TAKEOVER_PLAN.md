# TAKEOVER PLAN — Prompt-o-matic

## Current Goal

Take over development of Prompt-o-matic safely, without breaking the existing prompt generation and AI polish pipeline.

## Development Principle

Do not rewrite the system. Work in small, reversible steps.

## Current Known Core Flow

App.jsx
→ assembler.js
→ PromptOutput.jsx
→ usePolish.js
→ /api/polish
→ polishCore.js
→ LLM provider
→ PromptOutput.jsx display

See:

- `PROJECT_CONTEXT.md`
- `docs/TAKEOVER_FLOW.md`

## First Technical Objective

Add better observability before changing behavior.

The app should make it easier to understand:

- what prompt fragments were assembled
- what payload was sent to `/api/polish`
- which provider was selected
- whether fallback happened
- what final text was displayed

## Safe First Work Area

Frontend-only diagnostic UI.

Preferred files:

- `src/components/PromptOutput.jsx`
- `src/hooks/usePolish.js`
- possibly `src/App.jsx`

Avoid changing provider logic at first.

## Do Not Touch Yet

Avoid major changes in:

- `api/lib/polish/polishCore.js`
- `api/lib/llm/providers/*`
- Tauri sidecar logic
- ComfyUI integration
- database/vector systems

## First Real Feature Candidate

Create a developer/debug panel visible only in local development mode.

It should show:

- assembled prompt text
- polish request state
- selected AI engine
- localOnly status
- provider/fallback result if available
- last error if polish failed

## Acceptance Criteria

- `npm test` passes
- `npm run build` passes
- normal user UI remains unchanged unless debug mode is enabled
- no provider behavior changes
- no API contract changes unless explicitly documented

## AI Agent Instructions

Before editing code:

1. Read `PROJECT_CONTEXT.md`
2. Read `docs/TAKEOVER_FLOW.md`
3. Identify exact files involved
4. Propose a minimal plan
5. Make the smallest safe patch
6. Explain how to test it