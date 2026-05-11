# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install
npm run dev          # Vite + API middleware; auto-starts Chroma unless AUTO_START_CHROMA=false
npm test             # Vitest; exclude .claude/worktrees via package.json script
npm run build        # Production frontend bundle
```

On Windows, `npm run dev` typically uses system Node (often v24). Rebuild native modules when the Node major changes:

```bash
npm rebuild better-sqlite3
```

Run tests with the same Node major as dev when `better-sqlite3` ABI errors appear. Targeted worldbuilding suites:

```bash
npx vitest run api/lib/continuity api/lib/extrapolation api/ruslanMvpAcceptance.test.js api/ruslanMvpDoneGate.test.js
```

## Architecture Overview

Single-process local app: React 18 UI and ~55 `/api/*` routes are Vite dev middleware (`vite.config.js`), not a separate backend. SQLite (`better-sqlite3`) is canonical; Chroma is optional for batch similarity; ComfyUI renders images; LLM polish and extrapolation use Ollama, LM Studio, or Claude.

Legacy casting flow uses `characters` and prompt packs. The additive **entity layer** (`entities`, provenance-tracked `entity_attributes`, relationships, `visual_anchors`) powers the **Continuity** tab: six-stage extrapolation, reference anchors, conflict review, and MVP Done gate (five-scene continuity QA). See `PROJECT_CONTEXT.md` and `AGENT_HANDOFF.md` for tab map and API domains.

## Conventions & Patterns

- **Issue tracking:** `bd` only (`bd ready`, `bd update --claim`, `bd close`). Run `bd prime` after context loss. Session handoff ends with `git push`.
- **Entity attributes:** Always `writeAttribute` from `api/lib/db/repositories.js`; never raw `INSERT INTO entity_attributes` outside tests (`entityAttributesProvenanceGuard.test.js`).
- **Provenance:** `canon`, `inferred`, `suggested`, `temporary`, `derived` — every attribute write must set provenance and source stage when applicable.
- **Extrapolation:** Stage logic in `api/lib/extrapolation/` (orchestrator, parsers, prompts). Stage cache must use an isolated `cacheDir` in tests to avoid stale disk hits.
- **Continuity:** Primary `reference_image` anchor per entity; `buildComfyPromptPayload` injects anchor bytes when mapping allows. IPAdapter on Qwen-Image DiT is spec-only (`ipadapterFeasibility.js`); MVP uses reference-image conditioning.
- **API handlers:** Thin route files under `api/`; domain logic in `api/lib/`; register new routes in `vite.config.js`.
- **Frontend API clients:** `src/lib/api/*.js` wrapping `apiGet` / `apiPost` from `src/lib/api/http.js`.
