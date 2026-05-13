Resuming a session that crashed mid-way through Beads issue graph creation for docs/proposals/worldbuilding-continuity-system.md. State of the graph is unknown — could be partial.

Goal this session: audit what's already in Beads, identify gaps against the proposal, report before continuing. No new issues until I confirm the gap analysis.

Steps:

1. Run `bd list` (all states, all priorities) and `bd graph` if available. Dump the current issue inventory.

2. Cross-reference against the proposal structure:
   - Epics expected: Entity layer, Extrapolation layer (S1–S6 sub-epics), Continuity layer, Frontend (entity editor + attribute review panel + visual anchor picker), Migration/integration
   - P0 prerequisite: provenance enforcement (DB CHECK + single attribute-write helper) — verify this exists and that all extrapolation tasks block on it
   - P2 deferred issues: LoRA training, video, multi-user, graph DB migration — verify these exist as explicitly-deferred issues, not missing

3. Produce a gap report with three sections:
   - PRESENT: epics/features/tasks already in Beads
   - MISSING: what the proposal requires that isn't in the graph yet
   - SUSPICIOUS: anything in Beads that looks malformed (orphan tasks with no parent, missing dependencies, tasks tagged to non-existent stages, vague descriptions, sizing >1 day)

4. Also check:
   - Any uncommitted changes in the repo from the previous session (`git status`)
   - Any scratch files or notes Claude Code may have left in the working tree
   - Whether the Open Questions from Section 12 of the proposal were answered last session — if there's a record (commit message, doc edit, scratch note), surface it; if not, we need to redo that step before adding any extrapolation-layer tasks

5. Wait for me to confirm the gap analysis before creating, modifying, or deleting any issues.

6. After I confirm, fill the gaps using the same conventions as the original handoff: ~1 day tasks, explicit `bd dep add`, layer/stage tags, P0 = MVP path, P2 = deferred. Run `bd ready` at the end and walk me through the first 5–10 ready tasks.

Don't touch source. Don't assume the previous session was correct — if something looks off, flag it in the SUSPICIOUS section rather than building on top of it.