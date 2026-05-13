I've added a new proposal at docs/proposals/worldbuilding-continuity-system.md — a Worldbuilding & Continuity Intelligence layer on top of CastingRoom/Prompt-O-Matic.

Goal this session: turn that proposal into a complete, dependency-aware Beads issue graph. Planning only — no code, no source edits.

The proposal is the source of truth. Decisions already made there (3-layer architecture, SQL schema with provenance column, 6-stage pipeline, IPAdapter for visual continuity, FK-based relationships for v1, MVP scope, explicit non-goals) are not up for re-litigation. If you think a decision is wrong, flag it as a separate concern — don't fork the graph around an alternative.

Steps:

1. Read the proposal in full, including Section 3 (Non-Goals), Section 4 (MVP Definition), Section 5.2 (Data Model), and Section 12 (Open Questions).

2. Use Serena to map the current repo: prompt assembly pipeline, ComfyUI integration points, SQLite schema, ChromaDB usage, MCP layer, frontend structure. I need a clear delta of what already exists vs what's net-new in the entity/extrapolation/continuity layers.

3. Answer the 5 Open Questions in Section 12 by proposing a recommendation for each, with one-sentence rationale. I'll confirm or override before any issues are created. Do not create issues until I confirm.

4. After I confirm, build the Beads graph against the proposal's structure:
   - Epics: Entity layer, Extrapolation layer (with sub-epics per stage 1–6), Continuity layer, Frontend (entity editor, attribute review panel, visual anchor picker), Migration/integration
   - Features under epics
   - Tasks sized ~1 day each
   - Explicit `bd dep add` for every blocking edge
   - Tag tasks with layer (entity/extrapolation/continuity/frontend) and stage (S1–S6) where applicable
   - P0 = MVP path per Section 4 ("Done =" criterion)
   - P1 = polish on MVP path
   - P2 = explicitly deferred items per Section 3 (LoRA training, video, multi-user, graph DB migration) — create the issues so they exist, but mark blocked-by "MVP validated"
   - Mark the provenance enforcement work (DB CHECK constraint + single attribute-write helper) as P0 and as a hard prerequisite for any extrapolation stage task. Per Section 9, provenance bypass is the single highest-likelihood risk.

5. Run `bd ready` and walk me through the first 5–10 ready tasks so I can sanity-check the dependency chain before we move on.

6. Surface any task you can't size confidently — I'd rather split it than have a vague 3-day task in the graph.

Output: Open Question recommendations first, then the issue graph after I confirm. Don't touch source.