# improvementSuggestions2.md
# Application-Wide Improvements & Fixes

This document describes all identified improvements from the full application
audit against APPLICATION_REFERENCE.md. Read it fully before creating the
execution plan. Use Beads (bd) to structure the work as a dependency-aware
task graph. Use Serena to locate existing code before writing anything new.

These improvements are independent of the Casting Room flow fixes in
improvementSuggestions.md. They can be executed in parallel or after that
work is complete.

---

## CRITICAL

These address data integrity risks that compound silently over time.
Complete them before anything else.

---

### C1 — Eliminate payload_json dual-write for lifecycle_status

**What:** `lifecycle_status` exists as a proper SQL column on the `characters`
table AND inside the `payload_json` JSON blob. Every write path currently
updates both. Any code path that updates one without the other creates an
inconsistent character record.

**Why:** This is a structural risk that becomes a real bug the moment someone
adds a new code path that touches character state. It also blocks efficient
SQL-level querying — you can't index or filter on fields inside a JSON blob
in SQLite.

**Specifics:**

Use Serena to find every place in the codebase where `lifecycle_status` is
written. Search for:
- `lifecycleStatus` (camelCase, inside JSON payloads)
- `lifecycle_status` (snake_case, SQL column)
- `patchCharacterLifecycle`
- `setAuditioned`, `setPreview`, `setPortfolioPending`, `setPortfolioFailed`, `setReady`
- Any direct UPDATE on the `characters` table

For each write site, confirm both the column AND the payload_json are being
updated. Document which ones do both and which ones might miss one.

Then refactor: make the SQL column the single source of truth for
`lifecycle_status`. When reading a character, the API response should pull
`lifecycle_status` from the column, not from inside `payload_json`. When
writing, update the column first, then update the `payload_json` snapshot
as a secondary operation. If they ever disagree, the column wins.

Update `characterLifecycle.js` to be the only module that writes
`lifecycle_status`. No other code path should touch this column directly.
Use Serena to verify no other code path writes it after the refactor.

---

### C2 — Eliminate payload_json dual-write for embedding_status

**What:** Same pattern as C1 but for `embedding_status`. The column exists on
the `characters` table AND the value is stored inside `payload_json`.

**Why:** Same risk as C1. Any code path that updates one without the other
creates inconsistency.

**Specifics:**

Use Serena to find every place `embedding_status` or `embeddingStatus` is
written. Apply the same refactor as C1: column is the source of truth, payload
is the snapshot. Centralise all embedding status writes through a single
function (either in `characterLifecycle.js` or a dedicated
`characterEmbedding.js` service).

This task depends on C1 being complete — use the same pattern established
there.

---

### C3 — Fix hard delete to prevent orphan records

**What:** `DELETE /api/characters?id=<id>` hard-deletes the character row.
It does not cascade to `prompt_packs`, `generated_images`, `comfy_jobs`,
`actor_candidates`, or `actor_auditions` that reference the deleted
character's ID.

**Why:** Every hard delete potentially creates orphan records in up to five
tables. These orphans consume database space, appear in unfiltered queries,
and can cause errors if any code path follows a foreign key reference to a
character that no longer exists.

**Specifics:**

Use Serena to find the DELETE handler for `/api/characters`. Read the full
handler to confirm whether cascade deletion is implemented.

**If cascade is NOT implemented:** Add cascade deletion in a transaction.
Before deleting the character row, delete all related records:

```sql
BEGIN TRANSACTION;
DELETE FROM comfy_jobs WHERE character_id = ?;
DELETE FROM generated_images WHERE character_id = ?;
DELETE FROM prompt_packs WHERE character_id = ?;
DELETE FROM actor_auditions WHERE actor_candidate_id IN
  (SELECT id FROM actor_candidates WHERE
   payload_json LIKE '%"characterId":"' || ? || '"%');
DELETE FROM actor_candidates WHERE
  payload_json LIKE '%"characterId":"' || ? || '"%';
DELETE FROM characters WHERE id = ?;
COMMIT;
```

Note: the `actor_candidates` → character relationship may be stored
differently. Use Serena to find how `actor_candidates` references characters
before writing the cascade query. The relationship may be in `payload_json`
or in a direct column — check the schema and actual usage.

**If cascade IS implemented:** Document it and verify it covers all five
related tables. Close the task with confirmation.

**Additionally:** Update `character_batch_candidates` — if the deleted
character's ID is stored in `saved_character_id`, null it out and reset
`review_status` from `'saved'` to `'approved'`.

---

### C4 — Invert Character Builder persistence: SQLite primary, localStorage cache

**What:** The Character Builder currently saves to localStorage first and
syncs to SQLite in the background. Sync failures are silent. Deletion only
removes from localStorage, not from SQLite.

**Why:** The Prompt Builder reads bank entries from localStorage. The Casting
Room reads them from SQLite. If the background sync fails, the same character
is visible in one tab and missing in the other. This is a real user-facing
bug with no error indication.

**Specifics:**

Use Serena to find:
- `syncCharacter` and `removeCharacter` in `CharacterBuilder.jsx`
- The localStorage key `qpb_characters_v1` and everywhere it is read/written
- `rewriteScene` in `assembler.js` where `@slug` tokens are expanded
- The `GET /api/character-bank` and `POST/PUT/DELETE /api/character-bank`
  handlers

Refactor the write path:
1. On save: POST/PUT to `/api/character-bank` first (synchronous, not
   background). If the API call fails, surface the error to the user.
   Do not save to localStorage until the DB write succeeds.
2. On delete: DELETE from `/api/character-bank` first. Then remove from
   localStorage.
3. On mount (CharacterBuilder and App.jsx): load bank entries from
   `GET /api/character-bank`, populate localStorage cache from the DB
   response. This ensures localStorage always reflects the DB state.

Refactor the read path for `@slug` expansion:
- `rewriteScene()` currently reads from the `characters` object passed as
  a parameter, which comes from localStorage state. After this refactor,
  the `characters` object should be populated from the DB on mount. The
  assembler itself does not need to change — only the data source that
  feeds it.

Keep localStorage as a cache for performance (avoids an API call on every
keystroke in the scene input). But the DB is the authority. On any conflict,
the DB wins.

---

## HIGH

These address significant logic errors or UX problems.

---

### H1 — Stop overwriting classification on batch candidate approve/reject

**What:** When a batch candidate is approved, both `review_status` AND
`classification` are set to `'approved'`/`'accepted'`. When rejected, both
are set to `'rejected'`/`'rejected'`. This overwrites the original machine
classification from the similarity check.

**Why:** `classification` represents the system's automated assessment
(unique, needs mutation, too similar). `review_status` represents the user's
decision (approve, reject, reconsider). These are independent signals.
Overwriting `classification` on user action destroys the system's original
assessment. After a user approves a candidate that was classified as
`needsMutation`, both fields read `accepted`/`approved` — the mutation flag
is lost permanently.

**Specifics:**

Use Serena to find:
- `POST /api/character-batch-candidate-approve` handler
- `POST /api/character-batch-candidate-reject` handler
- `POST /api/character-batch-candidate-reconsider` handler
- The `approveBatchCandidate`, `rejectBatchCandidate`, and
  `reconsiderBatchCandidate` functions in `batchReview.js`

In each handler: remove the line that overwrites `classification`. Only
update `review_status`. The `classification` field should remain as it was
set by the batch generation similarity check — immutable after creation.

In `reconsiderBatchCandidate`: currently sets `classification='accepted'`.
Instead, restore `classification` to whatever it was before the user rejected
it. This requires either storing the original classification in a separate
field, or simply not overwriting it in the reject handler (which this fix
addresses). If reconsider is fixed to not touch `classification`, and reject
is fixed to not touch `classification`, then reconsider just needs to reset
`review_status` to `'pending'` without touching `classification` at all.

Verify that no downstream logic depends on `classification` being overwritten
by user actions. Use Serena to search for every read of `classification` in
the codebase and confirm they are compatible with an immutable classification.

---

### H2 — Default ENABLE_ flags to true in local-studio mode

**What:** Five feature flags (`ENABLE_CHARACTER_BATCH_API`,
`ENABLE_PROMPT_PACK_API`, `ENABLE_COMFY_API`, `ENABLE_GENERATED_IMAGES_API`,
`ENABLE_VECTOR_MAINTENANCE_API`) default to `false`. A new user who runs
`npm run dev` without setting up `.env.local` gets a Casting Room where
every feature is gated.

**Why:** The feature flags exist for cloud mode safety. In `local-studio`
mode they create friction without providing protection. A user's first
experience with the Casting Room should not be a 403 error.

**Specifics:**

Use Serena to find where each `ENABLE_*` flag is read. It will be in the
`assert*OperationAllowed` functions in the various `access.js` files and
possibly inline in `vite.config.js`.

For each flag check, add an APP_MODE-aware default:

```js
const isEnabled = process.env.ENABLE_CHARACTER_BATCH_API === 'true'
  || process.env.APP_MODE !== 'cloud';
```

This means:
- `local-studio` mode: all features enabled by default, flags can still
  disable specific features if explicitly set to `'false'`
- `cloud` mode: all features disabled by default, must be explicitly enabled

Alternatively, centralise this logic in a single `isFeatureEnabled(flagName)`
utility that all access guards call, so the APP_MODE fallback logic is in
one place.

---

### H3 — Remove hard delete from Actor Bank UI

**What:** The Actor Bank detail view has a delete button that triggers
`DELETE /api/characters?id=<id>`, which is a permanent hard delete.

**Why:** There is no undo. A misclick destroys the character and (after C3 is
implemented) cascades to all related records. The soft-archive system
(`archived_at`) already exists and is the appropriate user-facing action.
Hard delete should be a developer/maintenance tool only.

**Specifics:**

Use Serena to find `handleDelete` in `ActorBankView.jsx` and `ActorDetail.jsx`.

Replace the delete action with archive:
- Button label: "Archive" (not "Delete")
- Action: call `POST /api/character-archive` instead of
  `DELETE /api/characters`
- Add a confirmation dialog: "Archive [Name]? You can restore them later
  from the archived characters view."

Keep the `DELETE /api/characters` endpoint in the API for developer use
(accessible via Developer Tools or direct API call) but remove it from
the user-facing UI entirely.

If there is an "Archived" section or filter in the Actor Bank, verify it
shows archived characters with a "Restore" button. If this section does
not exist, add a simple "Show archived (N)" toggle at the bottom of the
Actor Bank filters that reveals archived characters with a Restore action.

---

### H4 — Add shadow columns for queryable character fields

**What:** The `characters` table stores all profile data in `payload_json`.
Filtering by `gender`, `age`, `name`, or `cinematicArchetype` requires
JSON parsing in application code. Add proper SQL columns for fields that
appear in WHERE clauses or filter parameters.

**Why:** The `GET /api/characters` endpoint accepts `gender`, `ageMin`,
`ageMax`, `search` as query parameters. These filters are either doing JSON
extraction in SQL (fragile, slow) or filtering in application code after
fetching all rows (does not scale). Proper columns enable SQL indexes and
efficient querying.

**Specifics:**

Add columns via migration:
```sql
ALTER TABLE characters ADD COLUMN name TEXT;
ALTER TABLE characters ADD COLUMN age INTEGER;
ALTER TABLE characters ADD COLUMN gender_presentation TEXT;
ALTER TABLE characters ADD COLUMN cinematic_archetype TEXT;

CREATE INDEX idx_characters_name ON characters(name);
CREATE INDEX idx_characters_gender ON characters(gender_presentation);
CREATE INDEX idx_characters_age ON characters(age);
```

Write a one-time backfill script that reads every existing character's
`payload_json`, extracts these four fields, and populates the new columns.

Update `createCharacter()` in `repositories.js` (or wherever characters are
inserted) to write these columns at creation time alongside `payload_json`.

Update `GET /api/characters` handler to filter using SQL WHERE clauses on
the new columns instead of JSON parsing.

Use Serena to find the current filter implementation in the GET handler
before writing the replacement — understand what it currently does before
changing it.

---

## MEDIUM

These address real friction but do not risk data integrity.

---

### M1 — Add startup cleanup for orphaned preview characters

**What:** Temporary characters with `lifecycle_status='preview'` are created
during batch preview rendering and deleted after image ingest. Deletion is
best-effort (`deleteTempCharacter(...).catch(() => {})`). Failed deletions
leave orphan preview characters in the database indefinitely.

**Specifics:**

On Casting Room mount (in `CastingPipelinePanel.jsx`), add a cleanup call:

```js
useEffect(() => {
  fetch('/api/characters?lifecycleStatus=preview')
    .then(res => res.json())
    .then(data => {
      const stale = data.items?.filter(c => {
        const age = Date.now() - new Date(c.createdAt).getTime();
        return age > 60 * 60 * 1000; // older than 1 hour
      });
      stale?.forEach(c => {
        fetch(`/api/characters?id=${c.id}`, { method: 'DELETE' });
      });
    })
    .catch(() => {}); // cleanup is best-effort
}, []);
```

Note: this requires `GET /api/characters` to support filtering by
`lifecycleStatus`. Use Serena to check whether this filter param is already
supported. If not, add it — it's a one-line addition to the WHERE clause
builder (and trivial once H4 shadow columns exist).

Alternatively, add the cleanup to the server side: run it once on dev server
startup in `vite.config.js` where the DB is initialised.

---

### M2 — Make batch status derivation lazy (compute on read)

**What:** `character_batches.status` is derived from aggregate candidate
statuses and recomputed on every candidate status change. If any code path
modifies a candidate without triggering recomputation, the batch status
becomes stale.

**Specifics:**

Use Serena to find `deriveBatchStatus` and `recalculateCharacterBatchSummary`.
Understand the current derivation logic.

Option A (recommended): Make derivation lazy. On `GET /api/character-batch`
and `GET /api/character-batches`, compute the status from current candidate
data rather than reading the stored `status` column. Remove
`recalculateCharacterBatchSummary` calls from approve/reject/reconsider
handlers — they become unnecessary.

Option B: Keep the current approach but add a verification step. On
`GET /api/character-batch?id=`, compare the stored status with a freshly
derived status. If they differ, update the stored status and return the
correct one. Log the inconsistency for debugging.

---

### M3 — Suppress validation panel during manual edit mode

**What:** When the user makes a manual edit in the Prompt Builder, the quality
score runs on the displayed (edited) text while the validation rules run on
the assembled (chip-derived) prompt. The two panels can show contradictory
information.

**Specifics:**

Use Serena to find where `validatePromptRules` is called in `PromptOutput.jsx`
and how it relates to the `manualEdit` state.

When `manualEdit !== null`:
- Show an indicator in the prompt output area: "Manual edit active — chips
  not reflected" (small, non-intrusive, below the textarea)
- Suppress validation warnings (hide the validation panel or show
  "Validation paused during manual edit")
- Quality score continues running on `displayText` (the manual edit) — this
  is correct behaviour since the score should reflect what the user sees
- Add a "Reset to assembled" button that clears `manualEdit` and restores
  the chip-derived prompt

Use Serena to confirm the current "Reset to assembled" mechanism exists.
If it does, verify it's visible when `manualEdit` is active. If it doesn't,
add it.

---

### M4 — Guard Chroma auto-spawn behind an environment flag

**What:** `vite.config.js` spawns a `chroma run` process on dev server start.
This creates an invisible dependency on the `chroma` binary being installed
on the host machine.

**Specifics:**

Use Serena to find the Chroma spawn logic in `vite.config.js`.

Add a flag check:
```js
const autoStartChroma = process.env.AUTO_START_CHROMA !== 'false';
```

Default: `true` (preserves current behavior for existing developers).
Set `AUTO_START_CHROMA=false` in any CI, Docker, or production environment.

Add `AUTO_START_CHROMA` to the environment variable reference in
`FULL_GUIDE.md` and `APPLICATION_REFERENCE.md`.

---

### M5 — Add version field to share URL encoding

**What:** The share URL encodes workspace state as base64 JSON in the URL
hash. There is no version field. If the state shape changes, old share URLs
will produce undefined behavior.

**Specifics:**

Use Serena to find where the share URL is encoded and decoded in `App.jsx`.

Add a version field to the encoded object:
```js
const shareState = { v: 1, scene, dirKey, charCount, ... };
```

On decode, check the version:
```js
const decoded = JSON.parse(atob(hash));
if (!decoded.v || decoded.v < CURRENT_SHARE_VERSION) {
  decoded = migrateShareState(decoded);
}
```

For now, `migrateShareState` can be a no-op that just adds any missing fields
with defaults. The point is that the version check exists for future use.

---

### M6 — Stop SSE watcher when no active jobs exist

**What:** The SSE watcher polls ComfyUI every 2 seconds as long as at least
one SSE client is connected, regardless of whether any active jobs exist.

**Specifics:**

Use Serena to find the watcher logic in `vite.config.js` (the SSE endpoint
handler).

Add an active job check before each poll cycle:
```js
const activeCount = db.prepare(
  `SELECT COUNT(*) as c FROM comfy_jobs WHERE status NOT IN ('success','failed')`
).get().c;
if (activeCount === 0) {
  // skip this poll cycle — no active jobs
  return;
}
```

The watcher interval itself can keep running (simpler than starting/stopping
the interval) — the check is cheap and prevents the ComfyUI poll when there
is nothing to check.

---

## LOW

These are improvements worth making but have no urgency.

---

### L1 — Add Vitest suite for assembler.js

**What:** The assembler is a pure function with 29 REWRITES entries and
three deduplication checks. No tests exist.

**Specifics:**

Install Vitest if not already present:
```bash
npm i -D vitest
```

Create `src/utils/__tests__/assembler.test.js`.

Test cases to cover:
- Each REWRITE independently (29 tests): input containing the trigger →
  verify output contains the expanded text
- Full assembly with known inputs → verify fragment order
- Deduplication: one test per check type (exact match, substring, overlap)
- Edge cases: empty scene, empty chips, all defaults, no director, no
  scenario
- Cascade rewrite: craft an input where REWRITE #1 produces text that
  matches REWRITE #2 — verify the output is correct (not double-rewritten
  unless intended)
- `@slug` expansion: input with `@test_char` → verify substitution from
  characters object
- `getCharDesc`: all gender × age combinations → verify output strings

---

### L2 — Raise custom directors cap from 3 to 10

**What:** `customDirectors` array is capped at 3 entries. The built-in set
has 61 directors. Users who work with niche directors not in the built-in
set are unnecessarily constrained.

**Specifics:**

Use Serena to find `saveCustomDirector` in `App.jsx` and the cap check.
Change the limit from 3 to 10 (or remove it entirely if there is no UI
layout concern).

If the director chip grid has layout issues with more entries, that's a
CSS problem to solve separately (use `auto-fill` with `minmax`), not a
reason to cap custom directors.

---

### L3 — Document project_id columns as reserved for Production Room

**What:** `project_id` nullable columns exist on `characters`, `prompt_packs`,
and `generated_images`. They are unused. They are forward-looking placeholders
for the Production Room concept.

**Specifics:**

Add a comment in `schema.js` above each `project_id` column:
```sql
-- Reserved for Production Room feature (Horizon 2). Not currently used.
project_id TEXT NULL,
```

Add a note in Section 9 (Known Gaps) of `APPLICATION_REFERENCE.md`:
"project_id columns on characters, prompt_packs, and generated_images are
reserved for the Production Room feature. They are not populated or queried
by any current code path."

No code changes needed.

---

## Execution Notes for Claude Code

- Use Serena before touching any file. Find the symbol, read the full
  function, trace its callers and callees. Never guess at file paths,
  function names, or column names.
- Use `bd ready` to see what is unblocked before starting each task.
- Claim tasks with `bd update <id> --claim` before starting them.
- Complete Critical items before High. Complete High before Medium.
- C1 and C2 are the same pattern — do C1 first, then apply the identical
  refactor to C2.
- C3 (cascade delete) should be done after C1/C2 so the delete handler
  is already cleaned up.
- C4 (Character Builder persistence inversion) is independent of C1-C3
  and can run in parallel.
- H1 (classification immutability) is independent of all Critical items.
- H2 (feature flag defaults) is independent and quick — good early win.
- H3 (remove hard delete from UI) depends on C3 (cascade delete must
  work before hard delete is even available as a developer tool).
- H4 (shadow columns) is independent but pairs well with C1/C2 since both
  involve character table schema changes. Consider combining the migrations.
- M1 (preview cleanup) depends on H4 if the cleanup needs to filter by
  lifecycle_status via SQL — otherwise it can use the existing API with
  JSON filtering.
- Close each task with a clear reason: what was found, what was changed, where.
- Run `bd sync` at the end of every session.
