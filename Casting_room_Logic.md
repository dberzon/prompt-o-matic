# Casting Room — Logic & Workflow

> Plain-language explanation of what the Casting Room is, how it works, and what every major function does.  
> Written as a reference for improving the workflow.

---

## What Is the Casting Room?

The Casting Room is the **production pipeline** of the app. It's the bridge between a written character description and a finished set of rendered portrait images.

Think of it like a real casting session for a film: you have a role to fill (a character description from the Character Bank), you bring in a pool of actors (LLM-generated candidate profiles), you photograph them (ComfyUI renders), review the shots, and approve the ones that work.

It connects three underlying systems:

| System | What it does here |
|---|---|
| **Character Bank** | Provides the character briefs (the "roles") |
| **LLM** | Generates actor candidate profiles from those briefs |
| **ComfyUI** | Renders the actual portrait images from prompt packs |

---

## Two Ways to Get Characters Into the System

The Casting Room has two distinct entry paths. They converge at the **Active Character** stage.

```
Character Bank entry
        │
        ▼
  Path A: Cast from Bank (Audition)
        │  LLM generates N candidate actors
        │  ComfyUI renders each one
        │  You approve / reject
        └──────────────────────────┐
                                   ▼
  Path B: Batch Pipeline       Active Character
        │  LLM bulk-generates        │
        │  candidate pool            │  Compile prompt packs
        │  Similarity dedup          │  Queue portfolio
        │  You review candidates     │  Poll for renders
        │  Save approved ones        │  Review gallery
        └──────────────────────────┘
```

---

## Path A — Cast from Bank (Audition)

### The Idea

You pick one character from your Character Bank and say "generate me N different actors who could play this role." The system spins up N distinct actor profiles and immediately queues renders for each one.

### Step-by-step Flow

1. **Select a bank character** — dropdown lists all Character Bank entries (the ones created in the Character Builder tab).

2. **Choose how many candidates** (`auditionCount`, default 3, max 10).

3. **Click "Generate Audition"** → `handleGenerateAudition()`

   - Calls `POST /api/audition/generate` → `runAudition()` on the backend.
   - Backend reads the bank entry's optimized description and calls the LLM with `buildBankEntryAuditionPrompt()` — a strict JSON prompt asking for exactly N actor profiles, each with required fields: age, face shape, eyes, hair, body type, wardrobe, cinematic archetype, personality energy, distinctive features, visual keywords.
   - For each profile the LLM returns:
     - Creates a `character` record in the database.
     - For each requested view angle (e.g. `front_portrait`, `profile_portrait`): compiles a prompt pack and queues a ComfyUI render job.
     - Creates `actor_candidate` and `actor_audition` records linking everything together.
   - Returns a results array: one entry per candidate, each with the ComfyUI `promptId`s for polling.

4. **Polling starts automatically** — `startAuditPoll()` sets a repeating timer (every `POLL_MS` ms). Each tick:
   - Asks ComfyUI for the status of all pending render jobs.
   - Updates status badges (pending → running → success/failed).
   - When a job succeeds, **auto-ingests** the image into the database and displays it under that candidate.
   - Stops polling when all jobs are either succeeded or failed.
   - Poll state is saved to `sessionStorage` so it survives tab switching.

5. **Review results** — each candidate card shows:
   - The rendered image(s).
   - **Approve** — marks that audition as approved (moves the character toward the actor bank).
   - **Reject** — marks it rejected (prompts for an optional reason).
   - **More Takes** — re-queues additional renders for selected view angles without regenerating the profile.

### `handleGenerateAudition()` — what it does
- Guards against running without a selected bank entry.
- Resets previous audition state and clears `ingestedRef` (deduplication tracker for auto-ingest).
- Calls the audition API, stores the returned results and builds an initial `auditionStatuses` map (all pending).
- After success, refreshes the characters list and auto-selects the first successfully created character in the Active Character section.

### `handleApproveAudition(auditionId)` — what it does
- Sends `PATCH` to mark that audition record as `approved`.
- Smoothly scrolls the page down to the Active Character section.

### `handleRejectAudition(auditionId)` — what it does
- Prompts the user for an optional rejection reason.
- Sends `PATCH` to mark that audition record as `rejected`.

### `handleMoreTakes(characterId, selectedViews)` — what it does
- Calls `POST /api/actor-more-takes` which re-compiles prompt packs for the specified views and re-queues ComfyUI jobs.
- Stores the new job list in `moreTakesState[characterId]`.
- Kicks the audit poller back on so new images auto-ingest when they complete.

---

## Path B — Batch Pipeline

### The Idea

Instead of starting from a hand-written character description, you ask the LLM to **invent** a whole pool of characters from scratch, filtered by age range, gender, and project tone. You get a batch of candidates, review them, and save the good ones.

### Step-by-step Flow

1. **Open the batch form** and set filters:
   - Age min/max
   - Gender presentation (optional)
   - Project tone / style (optional)
   - How many candidates to generate (default 10)

2. **Click "Generate Batch"** → `handleGenerateBatch()`
   - Calls `POST /api/characters-generate-batch`.
   - LLM invents N character profiles.
   - Each profile is checked for **similarity** against existing characters (vector similarity search) to prevent duplicates.
   - Results are persisted as a `character_batch` with each profile as a `character_batch_candidate`, classified as: `accepted`, `needs_mutation`, or `rejected`.
   - The new batch appears in the batch list and is auto-selected.

3. **Select a batch** from the dropdown → `refreshBatch(batchId)`
   - Loads the batch record and all its candidates from the database.
   - Displays each candidate with its classification and review status.

4. **Review candidates** — for each candidate:

   | Action | What happens |
   |---|---|
   | **Approve** → `handleCandidateAction('approve')` | Marks the candidate `approved` in the database |
   | **Reject** → `handleCandidateAction('reject')` | Marks it `rejected` with reason "Rejected manually" |
   | **Reconsider** → `handleCandidateAction('reconsider')` | Returns the candidate to `pending` review status |
   | **Mutate** | Sends the candidate back to the LLM with a mutation instruction to regenerate it with changes |
   | **Save** → `handleCandidateAction('save')` | Promotes the candidate to an active `character` record, auto-selects it in Active Character, and scrolls the page there |

5. **Refill** — if a batch has too many rejections you can ask for more candidates to be generated and added to it.

### `handleCandidateAction(action, candidateId)` — what it does
- Single function routing all four review actions through the appropriate API calls.
- After any action, refreshes the batch to show updated statuses.
- On `save`: extracts the new `characterId` from the response, adds it to the saved characters list, auto-selects it, and shows a feedback banner telling you to scroll to Active Character to generate images.

---

## Active Character Section

This section appears once a character exists in the database (via either path above).

### Flow

1. **Select a character** from the dropdown (all non-archived characters).

2. **Compile prompt packs** → `handleCompileAndListPromptPacks()`
   - Calls the backend to assemble Qwen-optimised text prompts for each view angle.
   - A "prompt pack" is one self-contained set of prompt text, negative prompt, and metadata for one view of one character.
   - Lists the compiled packs so you can see what was generated.
   - This also happens automatically whenever you select a new character (via `useEffect`).

3. **Queue portfolio** → `handleQueuePortfolio()`
   - You tick which view angles you want (front portrait, 3/4, profile, full body, audition still, cinematic scene).
   - Sends all selected views to ComfyUI in a batch.
   - The portfolio job list is stored in `sessionStorage` to survive tab navigation.
   - `startPortfolioPoll()` watches for completion and auto-ingests images as they finish.

4. **Review gallery** → `handleGeneratedImageReview(action, id)`
   - Lists all generated images for the active character.
   - Approve or reject individual images.

5. **Rename** → `handleRenameCharacter()`
   - Inline text field, updates the character name in the database and in local state.

6. **Archive** → `handleArchive(charId)`
   - Hides the character from the active list (moves to archived section).
   - Does not delete it.

7. **Restore** → `handleRestore(charId)`
   - Moves a character back from archived to active.

---

## Polling System

Both the audition path and the portfolio path use the same polling pattern:

```
startAuditPoll()           startPortfolioPoll()
      │                           │
setInterval(POLL_MS)        setInterval(POLL_MS)
      │                           │
auditTickRef.current()    portfolioTickRef.current()
      │                           │
  Check job statuses         Check job statuses
      │                           │
  Update status badges       Update status badges
      │                           │
  Auto-ingest successes      Auto-ingest successes
      │                           │
  All done? → stop           All done? → stop
```

Key design details:
- The tick functions are stored in **refs** (`auditTickRef`, `portfolioTickRef`) so they always read the latest React state without needing to be recreated — avoids stale closure bugs.
- A **`ingestedRef`** (a `Set`) tracks which `promptId`s have already been ingested, preventing double-ingest if polling overlaps.
- Session storage saves job lists so if you switch tabs (triggering a component unmount/remount), polling resumes automatically.

---

## Data Objects — What Is What

| Object | Where it lives | What it represents |
|---|---|---|
| `character_bank_entry` | DB | A written character description (created in Character Builder) |
| `character` | DB | A fully-fledged character record with visual profile fields (created by audition or batch save) |
| `actor_candidate` | DB | One render candidate linking a character to a prompt pack and a ComfyUI job |
| `actor_audition` | DB | One audition session for one candidate — has `status` (pending / approved / rejected) |
| `character_batch` | DB | A group of AI-generated candidates from one generation run |
| `character_batch_candidate` | DB | One candidate inside a batch, with classification and review status |
| `prompt_pack` | DB | One compiled prompt for one character × one view angle |
| `generated_image` | DB | One rendered image ingested from ComfyUI output |

---

## Backend Functions

### `runAudition()` — `api/lib/audition/auditionOrchestrator.js`

The core backend logic for Path A. Takes a bank entry ID, count, view list, an LLM function, and a ComfyUI service object.

1. Loads the bank entry from the database.
2. Calls `buildBankEntryAuditionPrompt()` to build the LLM prompt.
3. Calls the LLM (auto provider — cloud or local depending on settings).
4. Parses the JSON array from the LLM response.
5. For each profile in the array:
   - Validates the shape with `parseCharacterProfile()`.
   - Saves as a new `character` record.
   - For each view: compiles a prompt pack, queues a ComfyUI job (if ComfyUI is available), creates `actor_candidate` and `actor_audition` records.
6. Returns a summary: how many were requested, how many succeeded, how many failed, and full per-candidate detail.

ComfyUI errors are caught per-view and don't abort the whole run — if Comfy is down, you still get the character profiles and can queue renders later.

### `buildBankEntryAuditionPrompt()` — `api/lib/audition/auditionPrompts.js`

Builds the LLM prompt asking it to generate N actor profiles. It passes the character name and optimized description to the LLM, specifies every required field, and instructs it to return a strict JSON array with no prose. The LLM's job here is purely structured data generation, not creative writing.

### `persistBatchFromGeneration()` — `api/lib/characters/batchReview.js`

Takes the raw output of a batch generation run and saves it to the database as a `character_batch` with all its `character_batch_candidate` records. Each candidate gets a classification (`accepted`, `needs_mutation`, `rejected`) based on the similarity check results from the generation run.

### `saveCandidateAsCharacter()` — `api/lib/characters/batchReview.js`

Promotes a batch candidate to a permanent `character` record. Copies the candidate's profile JSON into the characters table and updates the candidate record with the new `savedCharacterId`.

### `approveCandidate()` / `rejectCandidate()` / `reconsiderBatchCandidate()` — `api/lib/characters/batchReview.js`

Simple status transitions on batch candidates. `reconsider` returns a candidate from `rejected` back to `pending` so it can be reviewed again.

### `mutateBatchCandidate()` — `api/lib/characters/batchReview.js`

Re-generates one candidate by sending its existing profile plus a mutation instruction to the LLM. Runs the similarity check again on the result. Saves the mutated version as a new candidate record linked to the original.

### `refillCharacterBatch()` — `api/lib/characters/batchReview.js`

Generates additional candidates and adds them to an existing batch. Used when too many candidates have been rejected and the batch needs topping up.

---

## Current Workflow Observations

These are things to keep in mind when improving the workflow:

1. **Two paths, one destination** — both Path A (Cast from Bank) and Path B (Batch Pipeline) ultimately produce characters that land in the Active Character dropdown. The paths feel disconnected in the UI even though they converge.

2. **Approve in audition ≠ save** — approving an audition result (`handleApproveAudition`) marks the audition record as approved but doesn't explicitly "do" anything further. The character already exists in the database from the moment the audition was generated. The approve/reject is a curation flag, not a creation step.

3. **Polling is invisible** — users can't easily tell whether polling is active or what's pending. The `isPollingAudit` state exists but may not be surfaced prominently enough.

4. **Manual prompt pack compile** — after selecting a character, prompt packs are auto-loaded if they already exist, but if a character was just created via audition, you need to explicitly compile them before queueing a portfolio. This step could be automated.

5. **No direct path from audition approve to portfolio** — after you approve an audition result, you have to manually scroll to Active Character, find that character in the dropdown, and queue a portfolio. The connection between "I liked this actor" and "generate their full portfolio" is not automatic.

6. **Batch candidates have no image previews** — in Path B, you review candidates as text-only profiles with no images. You have to save first and then queue renders. Path A is more visual because it generates renders immediately.

7. **ComfyUI coupling** — both paths depend on ComfyUI being available and configured. If ComfyUI is offline, Path A still creates character profiles but has no images to review. This edge case is handled gracefully in the backend but the UI doesn't make it obvious.
