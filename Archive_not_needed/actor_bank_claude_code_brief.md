# ACTOR BANK — Claude Code Implementation Brief
*Paste this document at the start of your Claude Code session as opening context.*

---

## BRIEF OVERVIEW

You are implementing the **Actor Bank** — a new primary view in the prompt-o-matic application that surfaces existing character management infrastructure through a usable UI. This is the single highest-leverage feature addition: it makes the already-built casting pipeline accessible to non-technical users and turns the app into a casting agent rather than a prompt builder.

**What you are NOT doing:**
- Rewriting any existing logic
- Touching the prompt builder UI or its state
- Changing any existing API route contracts
- Modifying the director system, chip system, or assembler

**What you ARE doing:**
- Adding a new view/page (Actor Bank) alongside the existing prompt builder view
- Adding a navigation system to switch between views
- Adding 3-4 missing API endpoints to support character retrieval and management
- Building the UI components that connect the existing backend to the user

Work in phases. Complete and verify each phase before moving to the next.

---

## CODEBASE CONTEXT

### Tech Stack
- React 18, Vite 5
- Plain JavaScript (no TypeScript)
- CSS Modules — no UI library
- Node.js API layer, serverless-compatible handlers in `/api/`
- SQLite via `better-sqlite3` — canonical data store
- ChromaDB via `chromadb` client — vector similarity
- Zod for runtime validation

### Key Files — Do Not Break These
```
src/
  App.jsx              — all state, two-column layout (1fr / 420px), sticky right panel
  App.module.css       — grid layout CSS
  index.css            — CSS custom properties, global resets
  data/
    directors.js       — DIRECTORS object + DIRECTOR_LIST (auto-generated from Object.keys)
    chips.js           — CHIP_GROUPS structure with subsections and value/label pairs
  utils/
    assembler.js       — pure function, combines inputs in cinematographic order

api/
  polish.js            — POST /api/polish
  characters-generate-batch.js  — POST /api/characters-generate-batch
  character-batches.js          — GET/POST /api/character-batches*
  prompt-pack-compile-character.js
  prompt-pack-compile-batch.js
  prompt-packs.js      — GET /api/prompt-packs
  lib/                 — service logic shared across handlers
```

### Existing API Routes (do not modify contracts)
```
POST   /api/polish
GET    /api/polish-health
POST   /api/characters-generate-batch
GET    /api/character-batches
GET    /api/character-batches/:batchId
POST   /api/character-batch-review       (approve/reject individual characters)
POST   /api/prompt-pack-compile-character
POST   /api/prompt-pack-compile-batch
GET    /api/prompt-packs
GET    /api/comfy-status
POST   /api/comfy-queue-character
GET    /api/generated-images
POST   /api/generated-image-approve
POST   /api/generated-image-reject
GET    /api/vector-status
POST   /api/vector-reindex
```

### CSS Custom Properties (from index.css — use these, don't invent new ones)
Before starting, read `src/index.css` to identify the existing custom properties (colors, spacing, typography). All new components must use these variables for consistency.

### APP_MODE
The app has two modes: `local-studio` (default) and `cloud`. Cloud mode blocks local-only mutation operations. Read `api/lib/` for the `APP_MODE` guard pattern before writing new API handlers.

---

## PHASE 1 — Read Before Writing

Before writing any code, read and summarise the following files. Output your summary as a comment block so I can verify you understood the codebase before proceeding:

1. `src/App.jsx` — understand the state shape, how views/panels are structured, how API calls are currently made
2. `src/index.css` — list all CSS custom properties defined
3. `api/lib/` — identify the shared utilities (db access pattern, APP_MODE guard, response helpers)
4. `api/character-batches.js` — understand what character data is already stored and in what shape
5. `api/character-batch-review.js` — understand what "approved" means in the current data model

**Stop after Phase 1 and show me your summary. Wait for my confirmation before proceeding.**

---

## PHASE 2 — Data Model Audit

### Goal
Understand exactly what character data already exists in SQLite and what shape it's in. No new code yet.

### Tasks

2a. Read the database schema (look for schema definition in `api/lib/db.js` or similar — find where tables are created).

2b. Identify: what columns does the `characters` table (or equivalent) have? Specifically, confirm:
  - Is there a field for `status` or `approved` to distinguish approved characters from candidates?
  - Is there a thumbnail or image reference stored?
  - Is there an archetype, age, gender field?

2c. Check if there is a join or relationship between characters and generated images.

2d. Output a clear summary:
```
CHARACTERS TABLE COLUMNS: [list]
APPROVED FILTER: [what query/field to use]
IMAGE REFERENCE: [how images are linked or where they live]
GAPS: [what's missing that the Actor Bank UI will need]
```

**Stop after Phase 2 and show me the summary. Wait for confirmation.**

---

## PHASE 3 — New API Endpoints

### Goal
Add the minimal set of new API endpoints required to support the Actor Bank UI. These must follow the exact same handler pattern as existing routes.

### Endpoints to Add

**3a. `GET /api/characters`**
Returns all approved characters. Query params: `gender` (filter), `ageMin`, `ageMax`, `search` (name/archetype text search).

Response shape:
```json
{
  "characters": [
    {
      "id": "string",
      "name": "string",
      "age": number,
      "gender": "string",
      "archetype": "string",
      "thumbnailUrl": "string | null",
      "createdAt": "string",
      "productionCount": number
    }
  ],
  "total": number
}
```

**3b. `GET /api/characters/:id`**
Returns a single character with full profile data including all reference images.

Response shape:
```json
{
  "id": "string",
  "name": "string",
  "age": number,
  "gender": "string",
  "archetype": "string",
  "appearance": { ... },
  "images": [
    { "id": "string", "view": "string", "url": "string", "approved": boolean }
  ],
  "promptPacks": [ ... ],
  "createdAt": "string"
}
```

**3c. `PATCH /api/characters/:id`**
Updates mutable fields: `name`, `notes`, `tags`. Does not allow updating generated fields (appearance, age, gender).

**3d. `DELETE /api/characters/:id`**
Soft-deletes a character (set status = 'archived', do not destroy records). Cloud mode: block with 403 and message.

### Implementation Rules
- Follow the existing handler file pattern exactly (look at `api/polish.js` as the reference)
- Use the same db access pattern from `api/lib/`
- Apply the APP_MODE guard on the DELETE endpoint
- Use Zod for request body validation on PATCH
- Return consistent error shapes matching existing routes

**Stop after Phase 3. Show me the four handler files for review before proceeding.**

---

## PHASE 4 — Navigation System

### Goal
Add a minimal top-level navigation to `App.jsx` that allows switching between the existing Prompt Builder view and the new Actor Bank view. The existing prompt builder layout must be completely unchanged when active.

### Implementation

4a. Add a `currentView` state to `App.jsx`:
```js
const [currentView, setCurrentView] = useState('promptBuilder'); 
// values: 'promptBuilder' | 'actorBank'
```

4b. Add a `<NavBar>` component (`src/components/NavBar/NavBar.jsx` + `NavBar.module.css`):
- Two nav items: "Prompt Builder" and "Actor Bank"
- Active state styling
- Clean, minimal — does not compete with the content below
- Uses only existing CSS custom properties from `index.css`
- Height: no more than 48px

4c. Conditionally render views in `App.jsx`:
```jsx
{currentView === 'promptBuilder' && <PromptBuilderView ... />}
{currentView === 'actorBank' && <ActorBankView />}
```

4d. Extract the existing two-column prompt builder layout into a `<PromptBuilderView>` component. Pass all existing props. The internal logic does not change — only wrapping.

**Important:** The prompt builder must work identically after this refactor. Verify by switching views back and forth — all state should persist (don't reset state on view change).

**Stop after Phase 4. Manual test and confirm prompt builder still works before proceeding.**

---

## PHASE 5 — Actor Bank View (Shell)

### Goal
Build the Actor Bank view shell — layout, filters, empty state, loading state. No character cards yet (data comes in Phase 6).

### Components to Create

```
src/components/ActorBank/
  ActorBankView.jsx        — top-level view, manages fetch state
  ActorBankView.module.css
  ActorBankFilters.jsx     — filter controls (gender, age range, search)
  ActorBankFilters.module.css
  ActorBankGrid.jsx        — grid container with loading/empty states
  ActorBankGrid.module.css
```

### ActorBankView behaviour
- On mount: fetch `GET /api/characters` with no filters
- Loading state: show skeleton grid (CSS-animated placeholder cards, same dimensions as real cards)
- Empty state: clear message + CTA button ("Generate your first characters →" — links to a placeholder for now)
- Error state: inline error message, retry button

### ActorBankFilters layout
- Search input (text, searches name + archetype)
- Gender selector: All / Female / Male / Non-binary (chips, not a dropdown)
- Age range: two number inputs (min / max), labelled "Age from" / "to"
- All filters are live — apply on change with 300ms debounce, no submit button
- Filter state lives in `ActorBankView`, not in individual filter components

### ActorBankGrid layout
- CSS Grid: `repeat(auto-fill, minmax(200px, 1fr))`, gap from CSS custom properties
- Renders `<ActorCard>` components (stubbed in this phase — just a placeholder div with correct dimensions)
- Shows total count: "24 characters in your bank"

### Styling rules
- Full-width layout (Actor Bank does not use the 1fr / 420px two-column split of the prompt builder)
- Uses only existing CSS custom properties
- No external UI libraries

---

## PHASE 6 — Character Card Component

### Goal
Build the `<ActorCard>` component that displays a character in the grid.

### Component spec

```
src/components/ActorBank/ActorCard/
  ActorCard.jsx
  ActorCard.module.css
```

### ActorCard layout (200px × 280px base)
```
┌─────────────────────┐
│                     │
│   [thumbnail img]   │  ← 200px × 180px, object-fit: cover
│   or [placeholder]  │  ← grey fill with person silhouette if no image
│                     │
├─────────────────────┤
│  Name               │  ← bold, truncated
│  Age · Gender       │  ← small, muted
│  Archetype          │  ← italic, truncated, muted
└─────────────────────┘
```

### Behaviour
- Entire card is clickable — calls `onSelect(character.id)` prop
- Hover state: subtle lift (transform + shadow), thumbnail slight scale
- No action buttons on the card itself (actions live in the detail panel)
- If `thumbnailUrl` is null: show a styled placeholder (CSS only, no external icons)

### Props
```js
ActorCard.propTypes = {
  character: shape({
    id: string,
    name: string,
    age: number,
    gender: string,
    archetype: string,
    thumbnailUrl: string | null,
  }),
  onSelect: func,
  isSelected: bool,
}
```

### Selected state
When `isSelected` is true: card gets a distinct border/highlight using existing accent color custom property.

---

## PHASE 7 — Character Detail Panel

### Goal
When a character card is clicked, show a detail panel with the full character profile and all reference images.

### Layout approach
Two options — pick based on what works better given the existing layout structure:

**Option A — Side drawer**: slides in from the right, overlays content (z-index above grid)
**Option B — Replaces grid**: clicking a card replaces the grid with a detail view, back button returns to grid

Recommendation: **Option B** — simpler, no z-index complexity, works better on smaller screens.

### Component

```
src/components/ActorBank/ActorDetail/
  ActorDetail.jsx
  ActorDetail.module.css
```

### ActorDetail layout
```
← Back to Actor Bank                    [Archive Character]

NAME (editable inline)
Age · Gender · Archetype

── REFERENCE IMAGES ──────────────────────────────────────
[front]  [three-quarter]  [profile]  [full body]  [+ more]
  Each image: 160px thumbnail, view label below, click to enlarge

── CHARACTER PROFILE ──────────────────────────────────────
Appearance details (from the character JSON, rendered as readable 
key-value pairs — not raw JSON)

── NOTES ──────────────────────────────────────────────────
[editable textarea — autosaves on blur via PATCH /api/characters/:id]

── PROMPT PACKS ───────────────────────────────────────────
List of prompt packs with copy buttons
```

### Behaviour
- On mount: fetch `GET /api/characters/:id`
- Name edit: click to make inline input editable, save on Enter or blur
- Notes: textarea, autosave on blur (debounce 800ms), show save indicator
- Archive button: confirm dialog ("Archive [Name]? They can be restored later."), then `DELETE /api/characters/:id`, return to grid
- Image click: lightbox (simple — CSS overlay with the full image, click outside to close)
- Back button: return to grid, preserve filter state

---

## PHASE 8 — Wire Up Cast From Batch Review

### Goal
Connect the existing batch review flow to the Actor Bank. When a character is approved in the existing batch review UI, it should appear in the Actor Bank automatically.

### Investigation first
- Read the existing batch review handler (`/api/character-batch-review.js` or equivalent)
- Understand what happens when a character is approved — what field is set, what table is updated
- Confirm that `GET /api/characters` (added in Phase 3) is already filtering on that field

### If the connection is already correct (approval → characters table → Actor Bank picks it up):
Just verify it works end-to-end. Document the flow.

### If there is a gap:
- Identify exactly what's missing (wrong status field, different table, etc.)
- Make the minimal fix in the existing approval handler to write the character into the Actor Bank query scope
- Do not change the batch review UI

---

## PHASE 9 — Empty State + Onboarding CTA

### Goal
Make the empty Actor Bank useful rather than blank for a new user.

### Empty state content
When the Actor Bank has 0 characters:

```
┌─────────────────────────────────────────┐
│                                         │
│         Your Actor Bank is empty        │
│                                         │
│    Generate your first cast of          │
│    characters to get started.           │
│                                         │
│    [  Run Casting Session  ]            │
│                                         │
│    ── or ──                             │
│                                         │
│    [ Create a single character ]        │
│                                         │
└─────────────────────────────────────────┘
```

- "Run Casting Session" → navigates to a casting panel (stub for now — can just log to console with a TODO comment noting Phase 2 of the roadmap)
- "Create a single character" → opens a simple character creation form (minimal: name, age, gender, archetype — no AI generation, just manual entry into the Actor Bank via `POST /api/characters`)

### `POST /api/characters` endpoint (add to Phase 3 work)
```json
{
  "name": "string (required)",
  "age": "number (required, 18-80)",
  "gender": "string (required)",
  "archetype": "string (optional)",
  "notes": "string (optional)"
}
```
Creates a character record with `status: 'manual'` and no generated images. It appears in the Actor Bank immediately.

---

## PHASE 10 — Final Polish & Verification

### Checklist
- [ ] Prompt builder works identically to before — test every feature
- [ ] Actor Bank view loads without errors on first visit (empty state)
- [ ] Characters from approved batches appear in Actor Bank
- [ ] Filter by gender works
- [ ] Filter by age range works
- [ ] Search by name/archetype works
- [ ] Character detail loads with all images
- [ ] Name edit saves correctly
- [ ] Notes autosave works
- [ ] Archive hides character from grid (does not delete data)
- [ ] Manually created character appears immediately in Actor Bank
- [ ] No console errors in any state
- [ ] All new CSS uses only existing custom properties (no hardcoded colors or pixel values that conflict with the design system)

### Performance
- Character grid should render 50+ cards without lag
- Fetch only on mount and on filter change (debounced) — no polling
- Images lazy-load (use `loading="lazy"` on all img tags)

---

## NOTES FOR CLAUDE CODE

- **Ask before inventing**: if you discover the actual data model differs significantly from what this brief assumes (different table name, different column names, different approval mechanism), stop and describe the difference before proceeding with that phase.
- **Minimal surface area**: do not refactor things that work. If existing code is ugly but functional, leave it.
- **CSS Modules only**: no inline styles, no Tailwind, no styled-components. Follow the pattern established in `App.module.css`.
- **No TypeScript**: plain JavaScript only, matching the existing codebase.
- **One phase at a time**: complete each phase, surface it for review, wait for confirmation before the next.

---

*Brief version: 1.0*
*Target: Horizon 1 — Actor Bank MVP*
