# Casting Room — Logic & Workflow (v2)

> Updated reference document reflecting the current state of the application after the Phase 1–3 overhaul and batch pipeline improvements.  
> Replaces `Casting_room_Logic.md`.

---

## What Is the Casting Room?

The Casting Room is the **production pipeline** of the app. It bridges a written character description and a finished set of rendered portrait images.

Think of it like a real casting session: you have a role to fill (a character description from the Character Bank), you bring in a pool of actors (LLM-generated candidate profiles), photograph them (ComfyUI renders), review the shots, and approve the ones that work.

It connects three underlying systems:

| System | What it does here |
|---|---|
| **Character Bank** | Provides the character briefs (the "roles") |
| **LLM** | Generates actor candidate profiles from those briefs |
| **ComfyUI** | Renders the actual portrait images from prompt packs |

---

## Two Ways to Get Characters Into the System

```
Character Bank entry
        │
        ▼
  Path A: Cast from Bank (Audition)
        │  LLM generates N candidate actors
        │  ComfyUI renders each one immediately
        │  Status bar shows live render progress
        │  You approve / reject / More Takes
        │  "Approve + Portfolio" queues full set in one click
        └──────────────────────────┐
                                   ▼
  Path B: Batch Pipeline       Active Character
        │  LLM bulk-generates        │
        │  candidate pool            │  Prompt pack selector + preview
        │  Similarity dedup          │  Queue portfolio
        │  Visual review (text)      │  Poll for renders (SSE or interval)
        │  Cast → preview renders    │  Review gallery
        │  Save approved ones        │
        └──────────────────────────┘
```

Both paths converge at **Active Character**. Characters created via Path A or Path B are identical once they land there.

---

## Path A — Cast from Bank (Audition)

### The Idea

Pick one character from the Character Bank and generate N distinct actors who could play that role. The system generates profiles and immediately queues ComfyUI renders for each one.

### Step-by-step Flow

1. **Select a bank character** — dropdown lists all Character Bank entries.

2. **Choose how many candidates** (`auditionCount`, default 3, max 10).

3. **Click "Generate Audition"** → `handleGenerateAudition()`
   - Calls `POST /api/audition/generate` → `runAudition()` on the backend.
   - Backend reads the bank entry's optimized description, calls the LLM with a strict JSON prompt asking for N actor profiles (age, face shape, eyes, hair, body type, wardrobe, archetype, personality energy, distinctive features, visual keywords).
   - For each profile: creates a `character` record (with `lifecycleStatus: 'auditioned'`), compiles prompt packs, queues ComfyUI render jobs, creates `actor_candidate` and `actor_audition` records.
   - Returns a results array with ComfyUI `promptId`s for polling.
   - Auto-selects the first successfully created character in the Active Character section.
   - Auto-compiles prompt packs for each new character in the background (`backgroundCompilePromptPacks`).

4. **Polling + SSE start automatically**
   - `startAuditPoll()` sets a backup interval (every `POLL_MS` = 20 s).
   - An SSE connection to `/api/render-events` fires immediate poll ticks when renders complete — status updates typically arrive in under a second instead of waiting for the next interval.
   - The **RenderStatusBar** (shown at the top of the panel whenever rendering is active) displays: total renders queued, done/total count, and whether the connection is live (SSE) or falling back to polling.

5. **Review results** — each candidate card (`CharacterCard`) shows:
   - Rendered image(s) as they arrive.
   - **Select this look** — marks that audition `approved`.
   - **Approve + Portfolio** — marks approved AND immediately queues a full portfolio render for the selected view angles, without extra clicks.
   - **Pass** — marks it `rejected` (prompts for an optional reason).
   - **More Takes** — re-queues additional renders for selected view angles. Available on both approved and rejected candidates.

### Key Handlers

**`handleGenerateAudition()`**
- Guards against running without a selected bank entry.
- Resets previous audition state and clears `ingestedRef`.
- Calls the audition API, stores results, builds initial `auditionStatuses` map (all pending).
- After success: refreshes characters list, auto-selects first created character, starts audit poll.

**`handleApproveAudition(auditionId)`**
- Sends PATCH to mark the audition record `approved`.
- Scrolls to Active Character section.

**`handleApproveAndQueuePortfolio(auditionId, characterId)`**
- Approves the audition, selects the character, then calls `queueCharacterPortfolio` with the current view selection and workflow.
- If no workflow is set, shows the "Generate Full Portfolio" toast instead.
- Starts portfolio polling.

**`handleRejectAudition(auditionId)`**
- Prompts for an optional rejection reason.
- Sends PATCH to mark the audition `rejected`.

**`handleMoreTakes(characterId, selectedViews)`**
- Calls `POST /api/actor-more-takes`, re-compiles prompt packs for the specified views, re-queues ComfyUI jobs.
- Stores new job list in `moreTakesState[characterId]`.
- Kicks audit poller back on so new images auto-ingest.
- Works regardless of audition approve/reject status.

---

## Path B — Batch Pipeline

### The Idea

Ask the LLM to invent a whole pool of characters from scratch, filtered by age range, gender, and project tone. Review the candidates as text profiles, cast the ones you want, optionally generate preview renders before committing, then save approved candidates as active characters.

### Step-by-step Flow

1. **Open the batch form** and set filters:
   - Age min/max
   - Gender presentation (optional)
   - Project tone / style (optional — biases aesthetic toward cinematic, editorial, or raw)
   - How many candidates (default 10)

2. **Click "Generate"** → `handleGenerateBatch()`
   - Calls `POST /api/characters-generate-batch`.
   - LLM invents N character profiles.
   - Each profile is checked for similarity against existing characters (vector search) to prevent duplicates.
   - Results persist as a `character_batch` with candidates classified: `accepted`, `needs_mutation`, or `rejected`.
   - The new batch is auto-selected in the dropdown (no manual searching required).
   - Dropdown labels show date, candidate count, and tone — not raw UUIDs.

3. **Review candidates** — displayed as `CharacterCard` components. Actions:

   | Action | Result |
   |---|---|
   | **Cast this character** | Marks candidate `approved`; button shows loading state only on that card |
   | **Dismiss** | Marks candidate `rejected` |
   | **Reconsider** | Returns a rejected candidate to `pending` |
   | **Save → Active Character** | Promotes to a permanent `character` record; scrolls to Active Character section |

   Visual cues:
   - **pending** → Cast + Dismiss buttons shown.
   - **approved** → Save button shown with accent styling; hint text: *"Ready to add to your cast — click Save to confirm."* Cast button hidden.
   - **rejected** → Reconsider shown; card dimmed.
   - **saved** → Green **"Saved ✓"** badge; no action buttons.

4. **Generate Previews** (optional, requires a workflow to be configured)
   - Appears above the candidate list when candidates exist and a workflow is selected.
   - Enabled only when at least one candidate is in `approved` state (deliberately does not target pending candidates).
   - Clicking **"Generate Previews"**  → `handleGeneratePreviews()`:
     - For each `approved` candidate not yet previewed:
       - Calls `saveBatchCandidate` → creates a `character` record in the DB.
       - Immediately patches `lifecycleStatus` to `'preview'` via `patchCharacterLifecycle`.
       - Queues a `front_portrait`-only render via `queueCharacterPortfolio`.
       - Tracks the job in `batchPreviewJobs[candidateId]`.
     - Starts the audit poller.
     - Refreshes the batch (candidates transition to `saved` in reviewStatus).
   - A counter beside the button shows "N/M previews ready" and updates live as renders complete.
   - When a preview render finishes it appears as a thumbnail on the candidate card.
   - Switching batches resets all preview state.

5. **Preview characters and the Active Character dropdown**
   - Characters created via Generate Previews have `lifecycleStatus: 'preview'`.
   - They are **filtered out** of the Active Character dropdown — they are not real cast members.
   - A notice above the dropdown shows "N preview character(s) (from batch previews)" with a **"Clean up"** button that archives all of them at once.

### Key Handlers

**`handleCandidateAction(action, candidateId)`**
- Routes all four review actions (approve / reject / reconsider / save) through the appropriate API calls.
- Uses `candidateActionId` (not a global flag) — only the acted-on card disables; all other cards stay interactive.
- On `save`: extracts `characterId` from the response, adds to saved characters with `lifecycleStatus: 'auditioned'`, auto-selects in Active Character, background-compiles prompt packs, scrolls to Active Character, shows "Generate Full Portfolio?" toast.

**`handleGeneratePreviews()`**
- Targets only `approved` candidates that haven't been previewed yet.
- Saves each, patches to `'preview'` lifecycle, queues `front_portrait` renders.
- Populates `batchPreviewImages[candidateId]` as renders complete.

---

## Active Character Section

This section is the shared destination for both paths.

### Lifecycle Status

Characters move through these statuses automatically:

| Status | Set when |
|---|---|
| `draft` | Character first created (default) |
| `auditioned` | Created via audition or batch save |
| `preview` | Created via Generate Previews (filtered out of dropdown) |
| `portfolio_pending` | Portfolio render queued |
| `ready` | At least one generated image approved |
| `finalized` | (reserved for future use) |

The dropdown shows `⏳` for `portfolio_pending` and `✓` for `ready`.

### Flow

1. **Select a character** — shows all non-archived, non-preview characters. Preview characters are excluded.

2. **Prompt packs** — auto-loaded whenever the selected character changes. The selector shows human-readable labels (e.g. "front portrait · eye-level frontal portrait") instead of UUIDs. Selecting a pack opens the **preview pane**: the full positive prompt in a scrollable monospace block, with the negative prompt in a dimmed section below a divider. A **Copy** button copies both prompts to clipboard and briefly shows "Copied!".

3. **Compile Prompt Packs** — manually recompile if needed. Auto-compiles in background whenever a character is created via either path.

4. **Queue portfolio** → `handleQueuePortfolio()`
   - Select view angles (front portrait, 3/4, profile, full body, audition still, cinematic scene).
   - Select a ComfyUI workflow.
   - Sends all selected views to ComfyUI in a batch.
   - Updates `lifecycleStatus` to `portfolio_pending`.
   - `startPortfolioPoll()` watches for completion, auto-ingests images.
   - "Generate Full Portfolio?" toast appears after batch save as a shortcut.

5. **Review gallery** → `handleGeneratedImageReview(action, id)`
   - Lists all generated images for the active character.
   - Approve ("Keep") or reject ("Discard") individual images.
   - Approving the first image sets `lifecycleStatus` to `ready`.

6. **Rename** → `handleRenameCharacter()` — inline text field, Enter to save.

7. **Archive / Restore** — hides/restores character from the active list without deleting.

---

## Polling & Real-Time Updates

```
SSE connection (/api/render-events)
        │
        │ render-update event
        ▼
  250 ms debounce
        │
        ├──► auditTickRef.current()     ← handles audition, moreTakes, batchPreview jobs
        │
        └──► portfolioTickRef.current() ← handles portfolio jobs

Fallback: setInterval(POLL_MS = 20 s) fires both ticks if SSE is unavailable
```

**Audit tick** handles three job types in one pass:
- `audition` — updates `auditionStatuses`, auto-ingests, populates `auditionImages[characterId]`
- `moreTakes` — updates `moreTakesState[characterId].jobStatuses`
- `batchPreview` — updates `batchPreviewJobs[candidateId].status`, populates `batchPreviewImages[candidateId]`

**Portfolio tick** handles portfolio jobs separately, updates `portfolioJobsStatus`, auto-ingests.

**Key design details:**
- Tick functions are stored in **refs** (`auditTickRef`, `portfolioTickRef`) so they always read the latest React state without stale closures.
- `ingestedRef` (a `Set`) prevents double-ingest if polling overlaps.
- Portfolio job list is saved to `sessionStorage` to survive tab navigation.
- SSE opens only while polling is active; closes automatically when all renders settle.
- `RenderStatusBar` shows "Rendering · N/M complete · live" (SSE) or "· polling" (fallback).

---

## Data Objects

| Object | Where it lives | What it represents |
|---|---|---|
| `character_bank_entry` | DB | A written character description (from Character Builder) |
| `character` | DB | A character record with visual profile fields and lifecycle status |
| `actor_candidate` | DB | One render candidate linking a character to a prompt pack and ComfyUI job |
| `actor_audition` | DB | One audition session for one candidate — has `status` (pending / approved / rejected) |
| `character_batch` | DB | A group of AI-generated candidates from one generation run |
| `character_batch_candidate` | DB | One candidate inside a batch, with classification and review status |
| `prompt_pack` | DB | One compiled prompt for one character × one view angle |
| `generated_image` | DB | One rendered image ingested from ComfyUI output |

---

## Backend Functions

### `runAudition()` — `api/lib/audition/auditionOrchestrator.js`

Core backend for Path A. Takes a bank entry ID, count, view list, LLM function, and ComfyUI service.

1. Loads the bank entry.
2. Calls `buildBankEntryAuditionPrompt()` to build the LLM prompt.
3. Calls the LLM (auto provider — cloud or local).
4. Parses the JSON array from the LLM response.
5. For each profile: validates, saves as `character` with `lifecycleStatus: 'auditioned'`, compiles prompt packs, queues ComfyUI jobs (gracefully skipped if Comfy is offline), creates `actor_candidate` and `actor_audition` records.
6. Returns a summary with per-candidate detail including `promptId`s.

### `saveCandidateAsCharacter()` — `api/lib/characters/batchReview.js`

Promotes a batch candidate (`reviewStatus: 'approved'`) to a permanent `character` record. Sets `lifecycleStatus: 'auditioned'`. Updates the candidate's `reviewStatus` to `'saved'` and records the new `savedCharacterId`.

Throws 400 if the candidate is not in `approved` state — enforces the cast-before-save flow.

### `approveCandidate()` / `rejectCandidate()` / `reconsiderBatchCandidate()` — `api/lib/characters/batchReview.js`

Simple status transitions on batch candidates. `reconsider` returns a candidate from `rejected` back to `pending`.

### `mutateBatchCandidate()` — `api/lib/characters/batchReview.js`

Re-generates one candidate by sending its existing profile plus a mutation instruction to the LLM. Runs similarity check on the result. Saves the mutated version as a new candidate record linked to the original.

### `refillCharacterBatch()` — `api/lib/characters/batchReview.js`

Generates additional candidates and appends them to an existing batch. Used when too many candidates are rejected.

### `updateCharacter()` + `patchCharacterLifecycle` — `api/lib/db/repositories.js` + `api/character-lifecycle.js`

`POST /api/character-lifecycle` accepts `{ characterId, lifecycleStatus }` and patches the character's lifecycle status. Valid values: `draft`, `auditioned`, `portfolio_pending`, `ready`, `finalized`, `preview`. Used by the frontend to track render pipeline state and to mark preview characters.

---

## Current State of the Workflow

These are the remaining edge cases and observations worth keeping in mind:

1. **Two paths, one destination** — Path A and Path B converge at Active Character. The UI treats them as separate sections but they share the same character list, prompt pack state, and gallery. This is intentional.

2. **Preview characters are transient** — Characters created via Generate Previews have `lifecycleStatus: 'preview'` and are hidden from the Active Character dropdown. They exist in the DB as real characters and can be cleaned up via the "Clean up" button (archives them). Phase 3 could add a "promote preview to active" flow.

3. **Generate Previews saves candidates as a side effect** — Clicking "Generate Previews" calls `saveBatchCandidate`, which changes the candidate's `reviewStatus` to `'saved'` and removes the Cast/Dismiss buttons from the card. This is intentional: you must cast a candidate (approve it) before previewing it.

4. **ComfyUI coupling** — Both paths depend on ComfyUI being available and configured. If ComfyUI is offline, Path A still creates character profiles (with no images). Path B can generate and review text candidates without ComfyUI; Generate Previews and portfolio queue will fail silently. The RenderStatusBar and status badges make the state visible.

5. **Approve in audition ≠ save** — In Path A, approving an audition (`handleApproveAudition`) marks the curation record but the character already exists in the DB from the moment the audition ran. The approve/reject is a curation flag.

6. **No vector re-indexing on batch save** — When a batch candidate is saved as a character, it is not immediately indexed into the vector store (`embeddingStatus: 'not_indexed'`). Future batches' similarity checks won't see it until a re-index runs.
