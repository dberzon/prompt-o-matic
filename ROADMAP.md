# Roadmap

*Current as of May 2026. Backlog is managed in the beads issue tracker — run `bd ready` to see actionable work.*

---

## Current State

All four application tabs are operational:

- **Prompt Builder** — Full assembly pipeline (61 directors, 29 REWRITES, deduplication, polish, variants, saved prompts/workspace profiles in SQLite)
- **Character Builder** — Character bank entry form with AI description optimization
- **Casting Room** — Path A (audition) and Path B (batch + similarity) fully functional; ComfyUI auto-poll/auto-ingest; SSE render events; active character portfolio management
- **Actor Bank** — Functional read-only character browser with filters

---

## Known Gaps (not yet built)

| Gap | Status | Notes |
|---|---|---|
| Prompt Builder ↔ Actor Bank integration | Planned | `@slug` tokens read from localStorage (Character Builder), not from the Actor Bank's `characters` table. Tracked: `qwen-prompt-builder-pv9` |
| Full Actor Bank UI | Planned | Tab works for browsing; direct casting and lifecycle management from the Actor Bank not implemented |

---

## Completed Milestones

- P1 — Critical casting room flow fixes (More Takes gate, ghost images, auto-poll + auto-ingest, LM Studio fixes)
- P2 — Casting Room overhaul (vocabulary cleanup, workflow selector, batch form, Journey B dismiss/reconsider)
- P3 — Character management (rename, archive/restore)
- P4 — Flow fixes and documentation sync (archive migration to SQLite, Journey A promotion, portfolio conditional copy, project tone)
- P5 — Prompt storage migration to SQLite, blend fix, display priority fixes, documentation update

---

## Reference

- `APPLICATION_REFERENCE.md` — complete source-verified reference document
- `AGENT_HANDOFF.md` — AI agent onboarding
- `bd ready` — available beads issues
