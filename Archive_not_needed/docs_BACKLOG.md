# Prompt-o-matic Backlog

This backlog is based on:
- `PROJECT_CONTEXT.md`
- `docs/TAKEOVER_FLOW.md`
- `TAKEOVER_PLAN.md`
- `docs/DEBUGGING.md`

It is organized for safe takeover work: observe first, then make small, reversible changes.

## Known Issues

- Provider/fallback metadata may be unavailable in frontend debug output (`n/a`) because backend responses do not always include these fields.
- Polish failures can be hard to diagnose without copying the debug snapshot immediately after failure.
- Runtime mode differences (web vs local studio) increase risk of environment-specific regressions.
- LLM output remains non-deterministic, so quality regressions may appear intermittently even with unchanged code.
- Async polish flow can fail for multiple reasons (engine selection, local model availability, API reachability) that look similar in UI.

## Safe First Fixes

- Improve frontend diagnostics in `PromptOutput` and `usePolish` only (labels, visibility, UX for debug state).
- Add small UX improvements around error messaging and recoverability (clearer retry/re-polish hints).
- Add targeted tests for frontend polish state transitions (`idle -> loading -> polished/error`) where coverage is thin.
- Strengthen docs around troubleshooting and reporting templates (keep `docs/DEBUGGING.md` up to date).
- Add optional frontend-only validation/warnings before sending polish requests (without changing backend behavior).

## Feature Ideas

- Add a timeline view for a single polish attempt (request start, response received, state transitions).
- Add a compact “session diagnostics” export that combines debug JSON with selected workspace settings.
- Add per-engine health badges with explicit recommended actions (for example, local model missing guidance).
- Add an optional “compare assembled vs polished” text diff view in output panel.
- Add a debug toggle to reduce visual noise while keeping local dev observability available.

## Dangerous Areas

- `api/lib/polish/polishCore.js` (core prompt-to-provider behavior and normalization).
- `api/lib/llm/providers/*` (provider-specific behavior and fallback chain implications).
- Provider resolution logic and async API request handling in polish pipeline.
- Embedded/local runtime integration boundaries (Tauri sidecar, local model orchestration).
- ComfyUI integration and database/vector subsystems (explicitly out of scope for early takeover tasks).

## Questions for Future Investigation

- Which provider/fallback fields should be guaranteed in API responses for reliable frontend observability?
- Should polish-health and polish-response metadata be unified into one consistent debug contract?
- What is the minimum stable test matrix across engines (`auto`, `embedded`, `local`, `cloud`) and `localOnly` mode?
- Which polish failure modes are most frequent in real usage, and can they be categorized into actionable UI messages?
- How should web mode vs local studio mode behavior be documented and validated to avoid drift?
- What acceptance baseline should be used for prompt quality consistency given LLM non-determinism?

