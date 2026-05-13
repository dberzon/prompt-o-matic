# Roadmap

*Current as of May 2026. Backlog is managed in the beads issue tracker — run `bd ready` to see actionable work.*

---

## Current State

All four application tabs are operational:

- **Prompt Builder** — Full assembly pipeline (61 directors, 29 REWRITES, deduplication, polish, variants, saved prompts/workspace profiles in SQLite). Character slots can be linked to Actor Bank characters; the linked character's description replaces the anonymous demographic descriptor in director scenario templates. Actor Bank characters are also available as `@slug` tokens in the scene input field (full visual description expansion). Includes manual Edit prompt mode, **Polish current text** for human→AI iteration on the displayed prompt, Comfy render from displayed text, and A/B compare snapshots with per-tab `sessionStorage` restore.
- **Character Builder** — Character bank entry form with AI description optimization, optional identity hints, and guidance strength (`light` / `strict_casting`) plus an in-tab **How this tab works** walkthrough.
- **Casting Room** — Path A (audition) and Path B (batch + similarity) fully functional; ComfyUI auto-poll/auto-ingest; SSE render events; active character portfolio management
- **Actor Bank** — Full character management UI: lifecycle status badges, image count, archived-characters toggle, inline rename, archive/restore, image keep/discard curation, sort options (recent renders / recently created / A–Z), portfolio re-queue on failure, and "Open in Casting Room" cross-tab bridge.

---

## Known Gaps

None at this time. All planned milestones through P6 are complete.

---

## Completed Milestones

- P1 — Critical casting room flow fixes (More Takes gate, ghost images, auto-poll + auto-ingest, LM Studio fixes)
- P2 — Casting Room overhaul (vocabulary cleanup, workflow selector, batch form, Journey B dismiss/reconsider)
- P3 — Character management (rename, archive/restore)
- P4 — Flow fixes and documentation sync (archive migration to SQLite, Journey A promotion, portfolio conditional copy, project tone)
- P5 — Prompt storage migration to SQLite, blend fix, display priority fixes, documentation update
- P6 — Actor Bank full UI (AB1–AB7) + initial Prompt Builder ↔ Actor Bank integration (pv9: bankCharId slot linking + effectiveCharacters @slug merge)
- P7 — Prompt Builder ↔ Actor Bank integration Phase 1-3: slug + prompt_descriptor columns on characters, LLM descriptor generation endpoint, auto-gen on creation (both paths), slug/descriptor backfill, ActorDetail descriptor UI; ActorBankPicker component + character slot import in DirectorSection, actorBankId state shape, share URL v2; actorBankSlugs cache + @slug expansion reads from Actor Bank, SceneInput @slug autocomplete

---

## Reference

- `APPLICATION_REFERENCE.md` — complete source-verified reference document
- `AGENT_HANDOFF.md` — AI agent onboarding
- `bd ready` — available beads issues
