# Architect Handoff Brief — Execution Spec for QPB → Character & World Bible

**Purpose:** Convert the architecture proposal in `Refactoring_And_Architecture_Improvement.md` into an atomic, machine-executable plan that a coding agent can translate 1:1 into `bd` (beads) issues and execute one at a time.

**Audience:** Senior software architect (you).
**Consumer of your output:** The coding agent (`bd ready` → claim → execute → close → push).

---

## Inputs you have

| File | Role |
|---|---|
| `comprehensive_review.md` | Diagnosis of the current codebase, gaps vs. the "universal Bible builder" vision |
| `Refactoring_And_Architecture_Improvement.md` | The architecture plan: target folder tree, ten architectural changes (C1–C10), seven-phase refactor sequence, risk map |
| `CLAUDE.md`, `.cursorrules`, `PROJECT_CONTEXT.md`, `AGENT_HANDOFF.md` | Project conventions, danger zones, build/test rules |
| The codebase at `c:\Users\user\Documents\qwen-prompt-builder` | Source of truth |

Code wins over docs. If the architecture plan and the code disagree, trust the code and note the discrepancy in the Execution Spec.

---

## Your deliverable — exactly one artifact

Produce **`docs/execution-spec.yaml`** (or `.md` with the same fields if you strongly prefer markdown). The file maps **Phases 0–5** of `Refactoring_And_Architecture_Improvement.md` into a flat list of atomic work items using the schema below.

Phase 6 (route extraction + frontend split) and Phase 7 (scene graph) live in an **Appendix D** of the spec — itemized but lower-resolution; they will be re-broken-down later.

---

## Hard constraints

1. **Atomicity.** Each work item must be ≤ 1 engineer-day. If bigger, split it. No exceptions.
2. **Total count.** Aim for **30–60 items across Phases 0–5**. If you produce fewer than 25 or more than 80, something is wrong — re-bucket.
3. **Field completeness.** Every field in the issue-spec schema below is required. `none` is an acceptable value, but the field must exist.
4. **File-scope isolation.** No two items may touch the same file unless one strictly `depends_on` the other (so they can never run in parallel and conflict).
5. **No prose narratives.** The output is structured data. Save the prose for the appendices.
6. **Preserve the polish prompt.** `api/lib/polishCore.js` lines 12–99 must be migrated **byte-equal** to `polish.system.v1.prompt.md`, gated by a snapshot test, before the inline version is removed. This is non-negotiable.

---

## Issue-spec schema (every work item uses exactly these fields)

```yaml
- id: arch.phase0.llm-client                          # kebab-case, unique
  title: "Introduce shared LlmClient and migrate extrapolation"
  phase: 0                                             # integer 0–5 (or 6/7 for appendix)
  priority: P0                                         # P0 (blocker) | P1 | P2
  est_days: 1.5                                        # number, ≤ 1.0 unless justified
  why: |
    One paragraph max. Link back to the section of the architecture plan
    (e.g. "Implements C1; removes 4 duplicate llmGenerate closures in
    vite.config.js").
  files_in_scope:
    - api/lib/llm/client.js                            # new
    - api/lib/llm/structuredOutput.js                  # new
    - api/lib/llm/telemetry.js                         # new
    - api/lib/extrapolation/llm.js                     # refactor
    - vite.config.js                                   # delete inline closures
  out_of_scope:
    - "Migrating polish.js call site (separate issue)"
    - "Changing provider implementations under api/lib/llm/providers/*"
  api_contract:
    new_exports:
      - "createLlmClient({ env, fetchImpl, telemetry }) -> { chat, raw, stream? }"
      - "callWithSchema({ client, promptId, variables, schema, maxRetries }) -> typed | throws LlmStructuredError"
    new_routes: none
    schema_diff: none
    sql_migration: none
  acceptance_criteria:                                  # all testable
    - "All 4 duplicate llmGenerate closures in vite.config.js removed"
    - "api/lib/extrapolation/llm.js delegates to createLlmClient"
    - "Existing api/lib/extrapolation/extrapolation.test.js passes unchanged"
    - "api/lib/llm/client.test.js covers raw + schema-validated + repair-retry paths"
    - "LlmStructuredError thrown when schema fails twice"
  test_plan:
    - "Add api/lib/llm/client.test.js — mock provider, assert chat/raw paths"
    - "Add api/lib/llm/structuredOutput.test.js — valid / repaired / fail-twice"
    - "Add api/lib/llm/telemetry.test.js — record shape, env-gated noop"
  depends_on: []
  blocks:
    - arch.phase1.prompt-registry-migration
    - arch.phase1.stage-parser-diagnostics
  risk: |
    One sentence. ("Low — pure wrapper around existing resolveProviderSelection.")
  rollback: |
    One sentence. ("Revert PR; provider files were not modified.")
```

---

## Field-specific rules

### `id`
- Format: `arch.phaseN.<topic>` in kebab-case. Example: `arch.phase2.character-bible-schema`.
- Stable. Once issued, never renamed (other items depend on it).

### `priority`
- **P0** = blocker for the phase
- **P1** = should ship in the phase
- **P2** = nice-to-have within the phase

### `files_in_scope`
- Explicit paths only — no globs.
- Mark `# new` for new files, `# refactor` for substantive edits, `# delete` for removal.
- Anything not listed is implicitly out of scope.

### `out_of_scope`
- The "temptation list." Anything a careless executor might bundle in.
- At minimum: name two related-but-deferred concerns.

### `api_contract`
- New / changed exports, with signatures.
- New HTTP routes: include method, path, request Zod schema, response Zod schema inline (or path to a schema file in the spec).
- Schema diff: SQL `CREATE TABLE` / `ALTER TABLE` inline if any.
- New UI components: props contract only; no implementation hints.

### `acceptance_criteria`
- Every bullet must be assertable by either a test or a grep.
- Bad: "code is cleaner."
- Good: "`server.middlewares.use(` count in vite.config.js ≤ 5."
- Good: "`api/routes/_registry.js` exports at least N entries."
- Good: "`getBibleCompleteness(db, entityId)` returns `{ ratio, missingRequired, missingRecommended }`."

### `test_plan`
- Name the test file(s) and the cases each covers.
- For prompt migrations: **always** include a byte-equal snapshot test of the rendered prompt vs. the previous inline string.
- For schema changes: include a migration round-trip test (apply migration, write canonical row, read it back).
- For new HTTP routes: include a smoke test via the dev-server middleware.

### `depends_on` / `blocks`
- Must form a DAG. No cycles. Verify before submitting.
- An item that touches the same file as another item must declare a dependency edge between them.

### `risk` and `rollback`
- One sentence each. If you cannot answer in one sentence, the item is too large — split it.

---

## Features to fold into the spec (net-new beyond the architecture document)

Slot these into the indicated phases with the same issue-spec rigor:

| Feature | Phase | One-line scope |
|---|---|---|
| **Auto-fill gaps agent loop** | 5 | "Fill missing wardrobe" button → calls `bible.detectGaps`, loops `attribute.write` via the tool registry |
| **Stage prompt regression harness** | 1 | Golden inputs + golden outputs per prompt id+version; CI fails on drift |
| **Per-project prompt overrides** | 3 | `prompts/library/_overrides/<projectSlug>/<promptId>.prompt.md` shadows the default |
| **Production Bible export** | 3 (or later) | Approved snapshot → Markdown + PDF (one-shot, server-rendered) |

Do **not** scope the following — list them in **Appendix B** with a one-line rationale each so they can be filed as `bd` follow-ups, not lost:

- Cross-shot drift detector (image-side similarity check)
- Render-time continuity violation detector
- Voice/dialogue Bible
- World map / spatial graph
- Per-character LoRA training pipeline
- Public read-only Bible share links
- Bible critique agent ("peer-review pass")
- Episodic timeline visualization
- Multi-user collaboration / presence

---

## Required appendices in the spec file

**Appendix A — Critical path summary.** One sentence per phase: "longest chain from Phase 0 to Phase 5 is X items, ~Y days." Then the actual chain as a list of item ids.

**Appendix B — Deferred features.** The "do not scope" list above, one-line rationale each. These will be filed as `bd` issues immediately as future work but not executed yet.

**Appendix C — Dependency-graph sanity check.** Either `cycles_found: none` or a list of cycles. (If you find any, fix them before submission.)

**Appendix D — Phase 6 + 7 placeholders.** Low-resolution itemization of route migration (Phase 6) and scene graph (Phase 7). One item per ~half-day of work; full spec contract not required yet.

**Appendix E — Open questions for the product owner.** Anything you cannot decide unilaterally. Examples:
- "Should `LocationBibleSchema` include weather/season as required or recommended?"
- "Should the scene graph support branching timelines in V2 or only linear?"
- "Default polish prompt version on a new project: latest or pinned?"

---

## What "done" looks like for this brief

You return `docs/execution-spec.yaml` (or `.md`) where:

- 30–60 work items across Phases 0–5, each conforming to the schema
- Every item ≤ 1 engineer-day, with explicit acceptance criteria and test plan
- A DAG with no cycles (verified in Appendix C)
- The four net-new features are folded in at the indicated phases
- The deferred features list is in Appendix B
- Appendices A, C, D, E are populated
- Polish-prompt migration is gated by a byte-equal snapshot test (verify this constraint appears in the relevant item's acceptance criteria)
- No item touches the same file as another item without a dependency edge between them

---

## What happens after you return

1. The coding agent reads the spec.
2. Dry-run: agent renders the resulting `bd` issue list and the dependency graph for the human owner to sanity-check.
3. On approval, agent runs `bd create` for every work item, sets dependencies, and starts `bd ready` execution.
4. Phase 6 and 7 (Appendix D) are re-opened to you for full-spec breakdown closer to their start time.
5. Deferred features (Appendix B) are created as `bd` issues with `priority: deferred` so they're discoverable but not pulled.

If during execution any work item turns out to span >1 day or touch out-of-scope files, the agent files a `bd` issue asking you to re-spec it. No silent scope expansion.

---

## One-paragraph TL;DR

You are converting `Refactoring_And_Architecture_Improvement.md` into a flat YAML list of 30–60 atomic work items, each ≤ 1 engineer-day, each with explicit file scope, API contract, acceptance criteria, test plan, and dependencies — so a coding agent can run `bd create` against the list and then execute `bd ready` end-to-end without further architectural decisions. Fold in four net-new features (auto-fill loop, prompt regression harness, per-project prompt overrides, Bible export), file nine others as deferred work, and ship one document: `docs/execution-spec.yaml`.
