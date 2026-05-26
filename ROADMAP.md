# Roadmap

*Current as of May 2026. Backlog is managed in the beads issue tracker — run `bd ready` to see actionable work.*

---

## Current State

The UI uses a **6-step workflow stepper** (`NavigationStepper.jsx`). Steps 1–4 are implemented; Steps 5–6 (Render, Portfolio) are placeholders.

- **Step 1 — Casting** — Three sub-tabs: **Casting Pipeline** (Path A audition + Path B batch, ComfyUI auto-poll/auto-ingest, SSE render events, active character portfolio), **Character Builder** (bank entries with identity hints/guidance strength), **Actor Bank** (full character management UI with lifecycle badges, archive/restore, sort, Open in Casting Room bridge)
- **Step 2 — Bible** — Entity lift from bank entry; bible editor (`src/features/bible/`); visual anchors
- **Step 3 — Extrapolation** — Type-aware extrapolation (`stageRegistry.js`), attribute review, S6 conflicts, MVP Done gate continuity QA (`EntityContinuityQaPanel`)
- **Step 4 — Prompt Studio** — Full assembly pipeline (61 directors, 29 REWRITES, deduplication, polish, variants, saved prompts/workspace profiles in SQLite). Actor Bank slot linking + `@slug` expansion. Manual Edit prompt, Polish current text, Comfy render, A/B compare with `sessionStorage` restore. `BibleQuickRef` sidebar when entity active.

---

## Known Gaps

- **Steps 5–6 (Render, Portfolio)** — Placeholder UI only; not yet implemented.
- **Standalone Continuity tab** — Removed; continuity QA lives in Extrapolation step (Step 3).

---

## Completed Milestones

- P1 — Critical casting room flow fixes (More Takes gate, ghost images, auto-poll + auto-ingest, LM Studio fixes)
- P2 — Casting Room overhaul (vocabulary cleanup, workflow selector, batch form, Journey B dismiss/reconsider)
- P3 — Character management (rename, archive/restore)
- P4 — Flow fixes and documentation sync (archive migration to SQLite, Journey A promotion, portfolio conditional copy, project tone)
- P5 — Prompt storage migration to SQLite, blend fix, display priority fixes, documentation update
- P6 — Actor Bank full UI (AB1–AB7) + initial Prompt Builder ↔ Actor Bank integration (pv9: bankCharId slot linking + effectiveCharacters @slug merge)
- P7 — Prompt Builder ↔ Actor Bank integration Phase 1-3: slug + prompt_descriptor columns on characters, LLM descriptor generation endpoint, auto-gen on creation (both paths), slug/descriptor backfill, ActorDetail descriptor UI; ActorBankPicker component + character slot import in DirectorSection, actorBankId state shape, share URL v2; actorBankSlugs cache + @slug expansion reads from Actor Bank, SceneInput @slug autocomplete
- P8 — Workflow stepper redesign: 6-step navigation (Casting → Bible → Extrapolation → Prompt Studio → Render → Portfolio placeholders); `WorkspaceContext` extraction; Step 1 sub-tabs; projects/bibles API routes; extrapolation streaming endpoints

---

## Reference

- `APPLICATION_REFERENCE.md` — complete source-verified reference document
- `AGENT_HANDOFF.md` — AI agent onboarding
- `bd ready` — available beads issues
