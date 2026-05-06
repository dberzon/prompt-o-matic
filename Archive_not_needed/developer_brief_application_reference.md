# Developer Brief — Application Knowledge Document
*Instructions for producing a single comprehensive reference document*
*covering the entire application's current state*

---

## Purpose

This brief asks you to write one document that describes the application
completely and accurately as it stands right now. The goal is a reference
thorough enough that an outside reader — including an AI assistant — can
understand every part of the application without needing to read the code.

Previous analysis rounds produced findings that were partially wrong because
the documentation had gaps and the reviewer had to make assumptions. This
document eliminates that problem. Write it from the code, not from memory.
Use Serena to locate exact implementations before writing any section.

The output document should be named `APPLICATION_REFERENCE.md` and placed
in the project root.

---

## General Rules

- Write from the code. If you are not certain how something works, check it
  with Serena before writing it down.
- Be specific. "Characters are stored in the database" is not useful.
  "Characters are stored in the `characters` table with columns X, Y, Z" is.
- Include exact values where they matter: counts, limits, thresholds,
  timeouts, field names, status strings.
- Do not describe planned or in-progress features as if they exist.
  Mark anything that is partial or in-progress explicitly.
- Where the code and existing documentation contradict each other, the code
  wins. Note the contradiction.

---

## Document Structure

Write the document in the following sections, in this order.

---

### SECTION 1 — Application Overview

One page maximum. Answer these questions in prose:

- What does this application do in one sentence?
- Who is it for?
- What are the four tabs and what is each one's single job?
- What is the dependency relationship between tabs?
  (e.g. "Tab 2 produces input for Tab 3; Tab 4 displays output from Tab 3")
- What external services does the application require to function,
  and which features break without each one?
- What is the current deployment model (local only, cloud, hybrid)?

---

### SECTION 2 — Full Database Schema

For every table in the database, document:

- Table name
- Every column: name, type, nullable, default, constraints
- Foreign key relationships
- Indexes
- What lifecycle or status values are valid for any enum-like columns
  (document the full set of allowed strings)

Present as a structured reference, not prose. Example format:

```
TABLE: characters
  id            TEXT  PRIMARY KEY
  name          TEXT  NOT NULL
  lifecycle_status TEXT NOT NULL DEFAULT 'auditioned'
                CHECK IN ('auditioned','preview','portfolio_pending',
                           'portfolio_failed','ready','archived')
  archived_at   TEXT  NULL
  created_at    TEXT  NOT NULL
  ...

INDEX: idx_characters_lifecycle ON characters(lifecycle_status)

FOREIGN KEYS:
  generated_images.character_id → characters.id
  ...
```

Include the migration history if relevant (note which columns were added
when, especially recent ones like `archived_at` and `lifecycle_status`).

---

### SECTION 3 — Complete API Reference

For every API endpoint, document:

```
METHOD  /api/path
Purpose: one sentence
Request body: { field: type (required|optional) }
Response: { field: type }
Side effects: what does it write to the database / external services
Auth/gating: APP_MODE restrictions, feature flags required
Error cases: what it returns on failure
```

Group endpoints by domain:
- Polish
- Characters (CRUD, lifecycle)
- Casting / Audition (Path A)
- Batch pipeline (Path B)
- Prompt packs
- ComfyUI integration (queue, status, ingest)
- Generated images (list, approve, reject)
- Vector / Chroma (status, index, similarity)
- Character Bank entries
- Saved prompts and profiles (if endpoints exist)
- Render events (SSE)

Also document every environment variable and feature flag:
- Variable name
- What it enables or controls
- What breaks if it is absent or false
- Which journey/feature requires it

---

### SECTION 4 — Prompt Builder Tab

#### 4.1 State
List every state variable in App.jsx that belongs to the Prompt Builder.
For each: name, type, initial value, what it controls, where it is persisted
(localStorage key if applicable).

#### 4.2 Assembly Pipeline
Document the complete assembler pipeline with the actual implementation:

- `rewriteScene(raw, characters)`: how many REWRITES entries exist, give 5
  representative examples of input → output pairs
- `assemblePrompt()`: the exact priority order of fragment collection,
  which dimensions have defaults and what those defaults are
- `dedupeFragments()`: document ALL THREE checks (Jaccard threshold,
  substring check, and the overlapToSmaller check with its threshold).
  Give one example that each check catches.

#### 4.3 Director System
- Exact director count (verify against `directors.js`)
- Schema of a director object (all fields)
- How scenarios are structured (confirm template literal syntax)
- How character descriptors are resolved (the `c[]` array — what values
  can appear and how they are derived from char state)
- How `DIRECTOR_PRESETS` relates to director scenario data
  (confirm they are separate; confirm they can be used independently)

#### 4.4 Director Blending
Document the exact algorithm:
- How are chips from two directors combined?
- How does the weight slider affect selection?
- How are same-dimension conflicts resolved?
  (e.g. both directors have a light chip — which one appears?)
- Does blending ever produce multiple chips in the same dimension?
- What happens to the validation system when a blend is active?

#### 4.5 Scene Matcher
`SceneMatcher.jsx` exists but is not documented. Write a full description:
- What does it do?
- How does the user access it?
- What input does it take?
- What does it output or change?
- How does it interact with chip state?
- What algorithm or data does it use to make matches?

#### 4.6 Display Priority
Document the PromptOutput display priority with the actual code behavior,
not the intended behavior. Specifically confirm:

- Does `handlePolish()` clear `restoredText` and `manualEdit` before
  displaying the polish result? (Developer confirmed yes — document it.)
- Does `handlePolish()` clear the selected variant before displaying
  the polish result? (This was unresolved — confirm from code.)
- What happens to a manual edit when a chip changes?
  (Does it persist or clear? Document the exact behavior.)
- What happens to a selected variant when a chip changes?
  (Does it persist or clear?)

#### 4.7 Quality Score
Document all scoring components with exact weights and the signal each
measures. Note whether any component behavior changes based on chip
state (e.g. does selecting a non-cinematic director affect scoring?).

#### 4.8 Validation Rules
List every rule in `promptRules.js` with:
- What it detects
- What it flags
- What the auto-fix action does

#### 4.9 Variants
- How are the three variants generated (exact append logic per variant)?
- What happens to the variant selection when chips change?
- What happens to the variant selection when Polish runs?

#### 4.10 Polish System
- Complete provider resolution chain with exact fallback order
- The full system prompt (or its key instructions — material specificity
  rules, length constraint, one-light discipline, director handling)
- Confirm: is `directorNote` injected into `buildUserMessage()`?
  If yes, show where and how.
- Confirm: does the system prompt have an "all other directors" fallback
  for unlisted directors? If yes, quote the relevant instruction.

#### 4.11 Persistence
- Which state variables are persisted to localStorage and under what keys?
- What is the saved prompts cap (confirm 30) and what happens at the cap?
- What is the prompt history length (confirm 12) and what happens at the cap?
- Are workspace profiles stored in localStorage or SQLite?
- Are saved prompts stored in localStorage or SQLite?

---

### SECTION 5 — Character Builder Tab

This tab is almost entirely undocumented. Write a full description:

- What is a "character bank entry"? (Distinguish clearly from a generated
  character in the Casting Room)
- What fields does the character bank entry form have?
- What validations exist on the form?
- What happens on save — what is written to the database, what table,
  what columns?
- What is the `@snake_case` slug — how is it generated, where is it used?
- How does the optimized description work — is there an LLM call that
  rewrites the user's description before saving, or does it save verbatim?
- How are bank entries listed/managed — can they be edited, deleted, reordered?
- What is the relationship between a bank entry and Path A in the Casting Room?
  (Does Path A read the raw description, the optimized description, or both?)

---

### SECTION 6 — Casting Room Tab

#### 6.1 Path A — Cast from Bank (Audition)

Document the complete flow with exact implementation details:

- `handleGenerateAudition()`: full call chain from button click to
  result display. What does `runAudition()` do step by step?
- At what point is the character record created in the database?
- At what point are prompt packs compiled?
- At what point are ComfyUI jobs queued?
- Auto-selection: confirm when it fires — on generation or on approval?
  (Note: this may have changed during the active improvement session)
- "Select this look": what does it do exactly? What is written to the
  database? What UI changes occur?
- "Approve + Portfolio": confirm whether it requires pre-selected view
  angles or uses defaults. Document the exact behavior.
- "Pass": what is written to the database?
- "More Takes": what is the gate condition — terminal job state or
  approval status? Confirm from code.
- Confirm whether auto-selection was fixed to fire on approval rather
  than generation (if this change was made in the current session).

#### 6.2 Path B — Batch Pipeline

- `handleGenerateBatch()`: full call chain
- Similarity check: what algorithm, what threshold, what does the
  classification result mean for each value
  (`accepted`, `needs_mutation`, `rejected`)
- Generate Previews: confirm whether this still creates character records
  as a side effect, or whether C2 has been implemented (transient preview
  images on candidate records). Document current actual state.
- "Shortlist", "Dismiss", "Reconsider": exact database writes for each
- "Save to Cast": full sequence — what is created, what status is set,
  what UI changes occur, what auto-selection/scroll happens
- Confirm whether similarity re-check at Save to Cast time has been
  implemented (C3). Document current actual state.
- "Project tone" field: confirm exactly how it affects the LLM prompt.
  Quote or paraphrase the relevant injection.

#### 6.3 Active Character Section

- Lifecycle status state machine: every valid status, every transition,
  what triggers each transition, and what triggers `portfolio_failed`
  if it has been implemented
- Prompt pack compilation: when does it happen, what does it produce,
  is it automatic or manual
- Portfolio queue: what happens step by step from button click to
  ComfyUI job submission
- Gallery: how are images retrieved, what does Approve/Keep do,
  what does Reject/Discard do, what happens to `lifecycle_status`
  on first approval
- Conditional copy: confirm the Journey A vs Journey B copy is implemented
  (audition images present vs not). Document the exact condition checked.

#### 6.4 Render System

- SSE endpoint: does `/api/render-events` exist and is `EventSource`
  in use on the frontend? Confirm current state.
- Polling: what is the current interval for the fallback? Confirm it
  is not exposed in user-facing UI copy (per previous fix).
- `ingestedRef`: confirm it is a Set, describe how it prevents
  double-ingestion
- Job persistence: confirm whether jobs are persisted in sessionStorage
  or SQLite (note if H3 has been implemented)
- RenderStatusBar: does it show Live/Polling state (M5)? Current state.

---

### SECTION 7 — Actor Bank Tab

Document the current actual state — not the planned state:

- What does the Actor Bank tab currently show?
- What data does it query and from where?
- What actions are available on it right now?
- What is its relationship to the Active Character dropdown in the
  Casting Room?
- Note clearly what is planned but not yet built.

---

### SECTION 8 — Cross-Cutting Systems

#### 8.1 Character Lifecycle — Complete State Machine

Draw or describe every lifecycle status a character can have, every
transition between them, and what code triggers each transition.
This should be exhaustive — every path from creation to archival.

#### 8.2 Vector / Chroma System

- What gets indexed into Chroma and when?
- What is the embedding model or method?
- What similarity threshold is used for classification?
- When does re-indexing run — automatically, manually, or both?
- Confirm whether Save to Cast now triggers re-index (C3/Issue #12).
- What does the vector maintenance API surface (`/api/vector-*` routes)?

#### 8.3 ComfyUI Integration

- What workflows are supported?
- How are prompt packs compiled into ComfyUI-compatible format?
- What is the polling/SSE mechanism for job status?
- How are completed images ingested (what path, what API call)?
- What happens when ComfyUI is offline — what fails, what succeeds?
- Job persistence: sessionStorage or SQLite (current state)?

#### 8.4 Navigation and Routing

- How does tab navigation work — is there a router or state-based switching?
- Does state persist when switching tabs?
- Is there any URL-based routing? If yes, what does a shared URL encode?

#### 8.5 APP_MODE

- What are the valid values?
- What exactly does each mode gate?
- Where is it checked in the codebase (list the handlers)?

---

### SECTION 9 — Known Gaps and In-Progress Work

Be explicit about what is not yet complete. For each item:

- What is the gap?
- Is it planned, in progress, or deferred?
- Does anything currently break because of it?

Include at minimum:
- Actor Bank UI (full implementation planned, current state)
- Generate Previews side effect fix (C2 — is it done?)
- Similarity re-check at Save to Cast (C3 — is it done?)
- Auto-select timing fix for Path A (H1 — is it done?)
- ComfyUI job persistence to SQLite (H3 — is it done?)
- SSE endpoint (M4 — is it done?)
- Saved prompts / profiles migration to SQLite — planned or deferred?
- Prompt Builder ↔ Actor Bank character integration — planned or deferred?

---

### SECTION 10 — File and Component Reference

A flat list of every significant file, what it does, and which section
of this document covers it. Organized by directory. This is a navigation
aid — one line per file is sufficient.

---

## Delivery

Filename: `APPLICATION_REFERENCE.md`
Location: project root
Format: Markdown
Length: as long as it needs to be — do not summarize where specifics matter

When complete, confirm:
- Every section is present
- No section says "TBD" or "see code" — if something is in the code,
  describe it here
- The lifecycle state machine in Section 8.1 is complete and matches
  the actual `lifecycle_status` CHECK constraint in the database
- The API reference in Section 3 matches the actual route handlers
  (use Serena to verify)
