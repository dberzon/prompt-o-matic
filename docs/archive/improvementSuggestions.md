# improvementSuggestions.md
# Casting Room — Improvements & Fixes

This document describes all identified improvements to the Casting Room feature.
Read it fully before creating the execution plan. Use Beads (bd) to structure
the work as a dependency-aware task graph. Use Serena to locate existing code
before writing anything new.

---

## CRITICAL

These must be completed before anything else. Other improvements depend on them.

---

### C1 — Add `lifecycle_status` column and centralize all status transitions

**What:** The `characters` table needs a `lifecycle_status` column that tracks
where a character is in the production pipeline. All status transitions must be
handled through a single backend service so no transition logic is scattered
across individual handlers.

**Why:** Currently, lifecycle state is implicit — inferred from which table a
character appears in or what fields are populated. This makes it impossible to
filter characters correctly, handle failure states, or reason about a
character's state from a single source of truth.

**Specifics:**

Add the column via migration:
```sql
ALTER TABLE characters ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'auditioned'
  CHECK(lifecycle_status IN (
    'auditioned',
    'preview',
    'portfolio_pending',
    'portfolio_failed',
    'ready',
    'archived'
  ));
CREATE INDEX idx_characters_lifecycle ON characters(lifecycle_status);
```

Note: `archived` replaces the boolean archive pattern. Confirm with Serena
whether `archived_at` timestamp (from P4 migration) is already in use — if
so, keep it and add `lifecycle_status` as a separate column. Both serve
different purposes: `archived_at` records when archiving happened,
`lifecycle_status` tracks production state.

Create `api/lib/characterLifecycle.js` with these transition functions:
- `setAuditioned(characterId)` — initial state after creation
- `setPreview(characterId)` — created via Generate Previews (transient)
- `setPortfolioPending(characterId)` — portfolio queue submitted
- `setPortfolioFailed(characterId)` — all ComfyUI jobs failed, revert to actionable state
- `setReady(characterId)` — first image approved by user
- `triggerReindex(characterId)` — queues vector re-index after Save to Cast

Add API endpoint: `PATCH /api/characters/:id/lifecycle`

Use Serena to find all existing places where character status is currently
being set or read before writing the service — consolidate them.

---

### C2 — Fix Generate Previews: make preview images transient, not promoted characters

**What:** Currently, clicking "Generate Previews" in Path B saves shortlisted
batch candidates as permanent `character` records with `lifecycleStatus:
'preview'`. This must be changed so previews are stored as transient image
fields on the `character_batch_candidate` record instead.

**Why:** The current behavior creates orphan character records every time a
user generates previews and doesn't promote all candidates. After several
batch sessions the database accumulates dozens of hidden preview characters
that consume vector index space and make similarity search less accurate.
Documenting this behavior is not an adequate fix — the architecture is wrong.

**Specifics:**

Add a `preview_image_url` column (nullable) to `character_batch_candidate`.

Update `POST /api/batch/previews`:
- Generate front portrait renders for shortlisted candidates as before
- Write the ingested image URL to `character_batch_candidate.preview_image_url`
- Do NOT create a `character` record
- Do NOT insert into the vector index

Update the candidate card UI to display the preview thumbnail from
`preview_image_url` when it exists.

Update "Save to Cast": this remains the only action that creates a `character`
record from a batch candidate. No change to Save to Cast logic itself.

Remove the "Clean up" button that bulk-archives preview characters — it will
no longer be needed. If it is wired to other functionality, use Serena to
check before removing.

Use Serena to find `runAudition`, `saveCandidateAsCharacter`, and the current
`POST /api/batch/previews` handler before writing any changes.

---

### C3 — Re-run similarity check at Save to Cast time and trigger re-index

**What:** The similarity check runs when a batch is generated. By the time the
user clicks "Save to Cast" (which may be minutes, hours, or a session later),
new characters may have been added that would have changed the classification.
Additionally, after Save to Cast, the new character is not immediately indexed
into the vector store, making it invisible to subsequent similarity checks.

**Why:** Both gaps mean the similarity system gives inaccurate results. A
candidate labeled "unique" at generation time could be a near-duplicate of a
character saved 10 minutes later. And characters saved via Path B are
invisible to the next batch generation's similarity check until a manual
re-index is run.

**Specifics:**

In the Save to Cast handler, before creating the character record:
1. Run a similarity check against the current vector index
2. If the candidate is now above the similarity threshold, return a warning
   response (not a block): `{ warning: 'similar_character_found', matches: [...] }`
3. The frontend shows: "This character is now similar to [Name] added recently.
   Save anyway?" with Confirm and Cancel options
4. If confirmed, proceed with save

After the character record is created:
1. Call `characterLifecycle.triggerReindex(characterId)` (from C1)
2. This queues or immediately runs the vector embedding and upserts into Chroma

Use Serena to find the existing similarity check logic and the Chroma upsert
code to reuse rather than rewrite.

---

## HIGH

Depend on Critical items or address significant logic errors.

---

### H1 — Fix auto-select timing: move from generation time to approval time (Path A)

**What:** In Path A, the first successfully generated character is automatically
selected as the Active Character immediately after generation — before the user
has reviewed any candidates or seen any images. Auto-selection should happen
when the user clicks "Approve" or "Approve + Portfolio", not at generation time.

**Why:** The user's choice and the system's auto-selected character will
frequently diverge. The best-looking candidate is rarely the first one
generated. When they diverge, the user either queues a portfolio for the wrong
character without noticing, or must manually correct the Active Character
dropdown — which defeats the purpose of the auto-selection.

**Specifics:**

Remove auto-selection from the generation handler (`handleGenerateAudition`).

Add auto-selection to the approval handlers:
- `handleApproveAudition(auditionId, characterId)` — select this characterId
  as Active Character after marking approved
- `handleApproveAndQueuePortfolio(auditionId, characterId)` — same

For Path B, auto-selection on Save to Cast is correct — keep it as-is.

After auto-selection in both paths:
- Scroll Active Character section into view (smooth scroll with 300ms delay)
- Show inline confirmation near the selected candidate card:
  "Character saved — find them in Active Character ↓"

Use Serena to find `handleGenerateAudition` and the current auto-select logic.

---

### H2 — Create unified CharacterCard component

**What:** Create a single reusable `CharacterCard` component used across Path A
audition results, Path B batch review, and optionally the Actor Bank. A `mode`
prop controls which action buttons are shown.

**Why:** Different card implementations per context means UI bugs and label
inconsistencies need to be fixed in multiple places. A unified component fixes
once, fixes everywhere.

**Specifics:**

Create `src/components/CharacterCard/CharacterCard.jsx` and
`CharacterCard.module.css`.

Props:
```js
{
  character: object,        // character or candidate data
  mode: 'audition' | 'batch' | 'preview' | 'bank',
  onAction: func,           // callback with (actionType, id) signature
  isSelected: bool,
  renderStatus: object,     // { status, progress } for live render feedback
  previewImageUrl: string,  // for batch preview thumbnails
}
```

Button sets per mode:
- `audition`: Select this look, Pass, More Takes
- `batch`: Shortlist, Dismiss, Reconsider (if dismissed), Save to Cast (if shortlisted)
- `preview`: Save to Cast only
- `bank`: Load as Active Character

Similarity classification label (unique / needs change / too similar) only
renders in `batch` mode.

Inline render progress (status badge + image when ready) renders in `audition`
and `preview` modes.

Use Serena to find all existing card implementations before writing the
unified component — consolidate their logic rather than starting from scratch.

---

### H3 — Move ComfyUI job persistence from sessionStorage to SQLite

**What:** Active ComfyUI job lists are currently stored in `sessionStorage`.
They must be moved to SQLite so that pending jobs survive browser closes,
crashes, and OS-level session ends.

**Why:** A full portfolio render can take 30-45 minutes. If the browser is
closed during this time, sessionStorage is wiped. ComfyUI continues rendering,
but the app never ingests the completed images when the user returns. The only
recovery path is the Developer Tools "Ingest Outputs" button, which most users
will never find.

**Specifics:**

Create a `comfy_jobs` table:
```sql
CREATE TABLE IF NOT EXISTS comfy_jobs (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  view_type TEXT NOT NULL,
  job_type TEXT NOT NULL,   -- 'audition' | 'portfolio' | 'preview' | 'more_takes'
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  completed_at TEXT
);
```

On app load (Casting Room mount): query for all non-terminal jobs
(`status NOT IN ('success', 'failed')`). If any exist, resume polling for
them automatically. Show the RenderStatusBar immediately if resuming.

Remove sessionStorage reads/writes for job lists.

Use Serena to find all sessionStorage references related to ComfyUI jobs
before making changes.

---

### H4 — Resolve `portfolio_pending` on ComfyUI failure

**What:** When all ComfyUI jobs for a character fail, `lifecycle_status` must
transition from `portfolio_pending` to `portfolio_failed`. The character must
not remain stuck in `portfolio_pending` indefinitely.

**Why:** If ComfyUI is offline or a workflow fails, every character whose
portfolio was queued stays in `portfolio_pending` forever. The `⏳` indicator
never resolves and the user has no recovery path from within the UI.

**Specifics:**

In the portfolio polling / tick function, when all jobs for a character reach
a terminal state:
- If at least one job succeeded → transition via `characterLifecycle.setReady`
  (first approved image will do this anyway — confirm the existing path)
- If all jobs failed → call `characterLifecycle.setPortfolioFailed(characterId)`
  (from C1)

In the Active Character dropdown, characters with `lifecycle_status =
'portfolio_failed'` show a `✗` indicator alongside the name.

A "Retry Portfolio" button appears in the Active Character section when the
selected character has `portfolio_failed` status. Clicking it re-queues the
same prompt packs and transitions back to `portfolio_pending`.

Use Serena to find the portfolio polling tick function and terminal state
detection logic.

---

## MEDIUM

UX improvements that reduce friction without changing core logic.

---

### M1 — Fix "Approve + Portfolio" hidden dependency on view angle selection

**What:** "Approve + Portfolio" silently degrades to a toast if no view angles
are pre-selected in the Portfolio section. The button must work without
requiring the user to have pre-configured view angles.

**Why:** View angle selection lives below the candidate review cards. A user
clicking "Approve + Portfolio" during review has likely not scrolled to the
Portfolio section yet. Getting a toast asking them to confirm something they
just clicked reads as a failure, not a shortcut.

**Specifics:**

Option A (recommended): "Approve + Portfolio" always queues all 6 default
views when no angles are pre-selected. Show a one-time dismissible note:
"Queued all 6 views. Adjust in Portfolio section to change defaults."

Option B: Clicking "Approve + Portfolio" opens an inline angle-selector
directly on the candidate card, making the dependency explicit and immediate
before submitting.

Remove the "Generate Full Portfolio?" toast triggered by this action.

---

### M2 — Replace per-save Portfolio toast with batch Portfolio action

**What:** The "Generate Full Portfolio?" toast that fires after "Save to Cast"
in Path B must be removed. Replace it with a persistent "Queue Portfolios for
all saved characters" action that appears after the review session is complete.

**Why:** The toast fires mid-review, interrupting the user before they have
finished evaluating all candidates. It causes a premature portfolio decision
for one character while several more candidates remain unreviewed.

**Specifics:**

Remove toast trigger from Save to Cast handler.

Add a "Queue Portfolios (N)" button above the Active Character dropdown that
appears when at least one character has been saved from the current batch and
no portfolios have been queued for them yet. N = count of saved characters
without a portfolio. Clicking it queues portfolios for all of them at once
using the currently selected workflow and default view angles.

---

### M3 — Add scope indicator and count to "Clean up" button

**What:** The "Clean up" button that archives preview characters must display
how many characters it will affect and from which scope before the user
commits.

**Why:** "Clean up" currently gives no indication of its scope — it may archive
characters from the current session, from all sessions, or from all time. A
user who has run several batch sessions with previews will not know how many
characters will be archived.

Note: if C2 is implemented, Generate Previews will no longer create character
records and this button may become unnecessary. Implement M3 only if the
"Clean up" button still exists after C2 is complete.

**Specifics:**

Update button label dynamically: "Clean up (6 preview characters from this
session)" or "Clean up (14 preview characters — all sessions)".

Add a confirmation dialog before executing that lists the character names
to be archived.

---

### M4 — Implement SSE endpoint and frontend EventSource handler

**What:** Confirm whether the SSE endpoint (`GET /api/render-events`) and
frontend `EventSource` connection are already implemented, or implement them.

**Why:** The workflow document describes SSE as the primary render update
mechanism with a 20-second polling fallback. If SSE is not yet implemented
and polling is the only path, every render update is delayed by up to 20
seconds.

**Specifics:**

Use Serena to check whether `/api/render-events` exists and whether
`EventSource` is used anywhere in the frontend. If both exist, confirm the
debounce pattern (250ms delay before triggering tick after SSE event) is in
place to prevent redundant calls when SSE fires multiple rapid events.

If SSE is not yet implemented:
- Backend: `GET /api/render-events` sends `text/event-stream` responses
- Frontend: `new EventSource('/api/render-events')` with handlers for
  `render-update` events and error/reconnect logic
- Fallback: 20-second polling interval activates only when SSE is closed or
  errored

---

### M5 — RenderStatusBar: add Live/Polling state indicator

**What:** The RenderStatusBar should display whether it is receiving updates
via SSE (real-time) or polling (periodic), so users understand the update
cadence.

**Specifics:**

Two message formats:
- SSE connected: "Rendering • 12/18 complete • Live"
- Polling fallback: "Rendering • 12/18 complete • Polling (updates every 20s)"

Bar is dismissible only when no active jobs remain.

Use Serena to find the existing RenderStatusBar component before modifying.

---

## LOW / PHASE 2

Improvements that add value but have no blocking dependencies.

---

### L1 — Add `last_rendered_at` timestamp to characters

Add a `last_rendered_at` nullable timestamp column to `characters`. Update it
whenever a new image is ingested for a character. Use it to sort characters in
the Actor Bank by most recent activity.

---

### L2 — Retry logic for failed ComfyUI jobs

When individual jobs (not all jobs for a character) fail, add automatic retry
with a maximum of 2 attempts before marking as permanently failed. Implement
inside the polling tick function. Pairs with H4.

---

### L3 — Prompt pack selector version handling

The prompt pack selector in Active Character should default to showing only
current packs (most recently compiled per view angle). Add a "Show history"
toggle to reveal older compiled versions. Default selected pack should be the
most recent front portrait pack.

Use Serena to find the prompt pack selector component before modifying.

---

### L4 — RenderStatusBar relationship to card-level progress

Confirm that inline render progress (status badge + image) is displayed on
each CharacterCard during active rendering. If card-level progress exists, the
RenderStatusBar serves as aggregate-only context (total count). If it does not
exist, add per-card status badges as part of the unified CharacterCard work
(H2).

---

## Execution Notes for Claude Code

- Use Serena before touching any file. Find the symbol, read the full function,
  trace its callers. Never guess at file paths or function names.
- Use `bd ready` to see what is unblocked before starting each work session.
- Claim tasks with `bd update <id> --claim` before starting them.
- Complete Critical items before High. Complete High before Medium.
- C1 (`characterLifecycle.js` service) must exist before H1, H4, and C3 —
  they all call into it.
- C2 (preview fix) should be verified complete before M3 (Clean up button) —
  M3 may become unnecessary.
- H2 (unified CharacterCard) can run in parallel with H3 and H4 once C1 is done.
- Close each task with a clear reason: what was found, what was changed, where.
- Run `bd sync` at the end of every session.
