# Debugging Guide

This guide explains how to run Prompt-o-matic locally and use the frontend Developer debug panel for polish pipeline issues.

## Run Locally

1. Install dependencies:
   - `npm install`
2. Start local development server:
   - `npm run dev`
3. Open the app URL shown in terminal (usually `http://localhost:5173`).

Notes:
- The Developer debug panel is only shown in local development mode.
- Production builds do not show this panel.

## Where the Developer Debug Panel Appears

- Go to the main Prompt Builder UI.
- Look at the right-side output area (`PromptOutput`) where prompt text and polish controls appear.
- The **Developer debug panel** appears under the engine health hint section and above polish/revert controls.
- It is visible only when running with Vite dev mode (`import.meta.env.DEV`).

## Debug Panel Fields

- **Request state**
  - Current frontend polish state: `idle`, `loading`, `polished`, or `error`.
- **Selected engine**
  - Engine selected for the last polish request (`auto`, `embedded`, `local`, `cloud`).
- **localOnly**
  - Whether cloud fallback is disabled for the last polish request.
- **Provider**
  - Provider reported by API response if available.
  - Can be `n/a` when backend did not include provider metadata.
- **Fallback**
  - Whether fallback occurred, if API response includes it.
  - Can be `n/a` when backend did not include fallback metadata.
- **Last error**
  - Most recent polish error captured on frontend (or `none` if no error).
- **Assembled prompt**
  - Prompt assembled on frontend before polish output overrides it.

## Copy Debug JSON

- Click **Copy debug JSON** in the Developer debug panel.
- This copies a structured JSON snapshot to clipboard, including:
  - assembled prompt
  - request state
  - selected engine
  - localOnly
  - provider/fallback (if present)
  - last error
  - last request payload snapshot
  - last response metadata snapshot

Recommended usage:
1. Reproduce the issue.
2. Click **Copy debug JSON** immediately after the failure/surprising result.
3. Paste the JSON into your bug report.

## What to Paste into Claude/Cursor for Bug Reports

When reporting a bug, include:

1. **Short symptom summary**
   - Example: "Polish fails in local-only mode with Ollama running."
2. **Exact steps to reproduce**
   - What you selected (director/scenario/chips), what you clicked, what happened.
3. **Expected vs actual behavior**
4. **Copied debug JSON**
   - Paste full JSON from **Copy debug JSON**.
5. **Environment details**
   - OS, whether running `npm run dev`, and engine/localOnly settings.
6. **Any visible UI/API error text**
   - Include exact error message text from the app.

Optional but useful:
- Screenshot of the Prompt output and debug panel at failure time.
- Whether issue reproduces consistently or intermittently.

## usePolish Hook Tests (jsdom)

The polish hook now has dedicated Vitest coverage in:
- `src/hooks/usePolish.test.js`

Covered behaviors:
- happy path state transition: `idle -> loading -> polished`
- debug capture on success (`lastRequest`, `lastResponse`)
- HTTP error handling and surfaced API error message
- non-JSON response handling
- dry-run behavior (`dryRun: true` skips fetch and sets `dry-run` state)
- empty fragment short-circuit (no fetch)
- `revert()` reset behavior

Run only this test file:
- `npx vitest run src/hooks/usePolish.test.js`

Important testing convention:
- Future hook/component tests should use jsdom test environment.
- Add this file header to UI/hook tests:
  - `@vitest-environment jsdom`

