# QPB Workflow Redesign — bd Beads Plan (v1)

This document converts the Antigravity v3 implementation plan, plus the corrections
from the architectural review, into 18 atomic `bd` issues you can hand to Cursor one
at a time.

The previous plan had three structural gaps: no beads for Steps 1, 2, or 3; the
cross-tab bridge depended on a sub-tab state that didn't exist yet; and the
aesthetic polish was dropped without explanation. This version fixes all three.

---

## Before you start — verify three anchor values

These three checks block bead-10 and bead-08. Run them locally **first** and
update this document with the real values.

### 1. SHA-256 of the polish prompt

Antigravity claimed `fe52cedfa06328138a2c0e8c8b8f615d819d41b45600d90f9711958df506e0e1`.
Verify against your tree:

```bash
sha256sum api/lib/prompts/library/polish.system.v1.prompt.md
```

If the hash differs, the bead-10 snapshot test will fail on first run. Update the
hash in bead-10 to whatever sha256sum returns on the current `main`.

### 2. Bible schema keys

Antigravity listed these keys as the ones to inject into the polish system prompt:

```
demographics.gender, demographics.ageRange, demographics.eraLabel, demographics.housingNotes
physical.height, physical.build, physical.face, physical.eyes, physical.nose, physical.lips, physical.skin
wardrobe.everyday, wardrobe.accessories
voice.dialogueDeliveryNotes, voice.accentOrDiction
psychology.temperament, psychology.motivations
history.biographySummary, history.educationOrWork, history.habits
visuals.portraitBrief, visuals.continuityKeywords
```

Open `api/lib/bibles/schemas/characterBible.schema.js` and confirm each exists.
Cross-reference with `api/lib/bibles/projection.js` (the `projectBibleNested`
output) — if a key isn't in the projection, injecting it will silently produce
`undefined` strings in the LLM system prompt.

Any key not in the schema must be removed from bead-10 before running.

### 3. Current App.jsx line count

```bash
wc -l src/App.jsx
```

Bead-01's acceptance criterion is `≤ 500`. If the current value is already at or
near 500, bead-01 shrinks or disappears; if it's much larger (the architect's
review estimated ~970), bead-01 stays as the first item.

---

## How to use this plan with Cursor

**One bead per Cursor session, one bead per branch.** Don't let Cursor see the whole
plan at once — it'll try to do everything and you'll be back to where Antigravity
left you.

For each bead:

1. `git checkout -b bead/<id>` from a clean `main`
2. File the bead in `bd`: `bd new --from-file beads/<id>.md` (or however your
   `bd` workflow ingests specs — adapt to your local toolchain)
3. Open Cursor in the project root. Paste the prompt template below, replacing
   `{{BEAD_BODY}}` with the full bead spec from this document.
4. Let Cursor implement only the files in `files_in_scope`.
5. Run the named tests from `test_plan`. They must pass.
6. Visually inspect the diff. If Cursor touched anything outside `files_in_scope`,
   revert those changes — that's the whole point of the scope contract.
7. Commit with message `bead-<id>: <title>`.
8. Open a PR or merge to `main`. Close the bd issue.
9. Repeat for the next bead.

### Cursor prompt template

```
You are implementing a single bd issue. Read the full spec below. Implement only
the files listed under `files_in_scope`. Do not touch any other file. Do not modify
tests in files that aren't named in `test_plan`. Do not run `git commit` — I will
review the diff first.

When you're done:
1. Run the tests named in `test_plan` and paste the output.
2. List every file you changed. If anything is outside `files_in_scope`, revert it.
3. Stop. Do not start the next bead. Do not update any task list.

Spec:

{{BEAD_BODY}}
```

That last instruction matters. Cursor will sometimes try to "be helpful" by
starting the next item. Cut it off.

---

## The 18 beads

DAG summary (full edge list in Appendix A):

```
01 ──> 02 ──> 03 ──┬──> 04 ──> 05 ──> 06 ──> 07 ─┐
                   │                              │
                   ├──> 08 (share URL) ───────────┤
                   │                              │
                   └──> 09 (workspace persist) ───┤
                                                  │
                                                  v
                                                  10 (polish backend)
                                                  │
                                                  v
                                                  11 ──> 12 ──> 13 ──> 14
                                                                      │
                                                                      v
                                                                      15 ──> 16
                                                                             │
                                                                             v
                                                                             17 ──> 18
```

---

### Bead-01: Extract WorkspaceContext, ShareLinkContext, EmbeddedHealthContext from App.jsx

- **id**: `arch.app.extract-contexts`
- **title**: Extract three React contexts from App.jsx; reduce App.jsx to ≤ 500 lines
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/context/WorkspaceContext.jsx` — scene text, chips, presets, custom directors, history
  - `[NEW] src/context/ShareLinkContext.jsx` — share link encode/decode (existing logic, just relocated)
  - `[NEW] src/context/EmbeddedHealthContext.jsx` — Comfy status, SSE log buffer, online/offline indicator
  - `[MODIFY] src/App.jsx` — replace inline state with context consumers
  - `[MODIFY] src/main.jsx` — wrap App in the three new providers (in addition to existing ProjectProvider)
- **out_of_scope**:
  - Any new state, any new feature, any UI change
  - Modifying any child component that uses the relocated state
- **api_contract**:
  - Each context exports `<XProvider>` and `useX()` hook
  - Hook return shape is identical to the state object that was previously in App.jsx
- **acceptance_criteria**:
  - `wc -l src/App.jsx` returns a value ≤ 500
  - `git diff --stat src/App.jsx` shows mostly deletions
  - All existing tests that pass on `main` still pass on this branch
  - `npm run dev` boots without console errors
- **test_plan**:
  - `src/App.test.jsx` (new or extend existing): renders `<App />` inside all four providers (Project + Workspace + ShareLink + EmbeddedHealth), asserts the component tree mounts without throwing
  - Run the full suite: `npx vitest run` — zero new failures vs. `main`
- **depends_on**: []
- **blocks**: [`arch.app.project-header`]
- **risk**: Medium. App.jsx is the central component; extraction errors will surface as runtime mount failures
- **rollback**: `git restore src/App.jsx src/main.jsx && rm -rf src/context/WorkspaceContext.jsx src/context/ShareLinkContext.jsx src/context/EmbeddedHealthContext.jsx`

---

### Bead-02: Move Project Selector to a persistent header

- **id**: `arch.app.project-header`
- **title**: Render ProjectSelector unconditionally in the header above all step content
- **priority**: P0
- **files_in_scope**:
  - `[MODIFY] src/App.jsx`
  - `[MODIFY or NEW] src/components/AppHeader.jsx` (if a header component doesn't yet exist, create one)
- **out_of_scope**:
  - Project CRUD UI (create/rename/delete projects) — assume the existing ProjectSelector handles it
  - Any change to `src/app/ProjectSelector.jsx` itself
- **api_contract**:
  - Header renders `<ProjectSelector />` from existing code
  - When `activeProjectId` is `null`, App.jsx renders a blocking overlay with a "Select or create a project to continue" message; step content is not mounted
- **acceptance_criteria**:
  - `screen.getByRole('combobox', { name: /project/i })` (or whatever role the ProjectSelector renders as — verify in the existing component) is queryable on every step from 1 to 6
  - When `useProject().activeProjectId` is `null`, querying for `data-testid="step-content"` returns `null`
  - `/dev-dashboard` is NOT affected by the project gate (the route bypasses both header and step content)
- **test_plan**:
  - `src/App.test.jsx`: test that header renders on every step; test that null `activeProjectId` blocks step content with overlay
- **depends_on**: [`arch.app.extract-contexts`]
- **blocks**: [`arch.app.stepper-shell`]
- **risk**: Low
- **rollback**: `git restore src/App.jsx && rm -f src/components/AppHeader.jsx`

---

### Bead-03: NavigationStepper shell + /dev-dashboard early return

- **id**: `arch.app.stepper-shell`
- **title**: Replace tab buttons with a 6-step stepper; preserve /dev-dashboard routing
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/NavigationStepper.jsx`
  - `[NEW] src/components/NavigationStepper.module.css`
  - `[NEW] src/components/NavigationStepper.test.jsx`
  - `[MODIFY] src/App.jsx`
- **out_of_scope**:
  - Step container contents (those are beads 04, 06, 07, 11, 13, 15)
  - Aesthetic polish (bead-17)
  - Adding `activeCharId / activeEntityId / activeBankSlug` — they come with the step containers that need them
- **api_contract**:
  - `<NavigationStepper activeStep setActiveStep />` — 6 clickable steps with labels
  - `App.jsx` introduces `const [activeStep, setActiveStep] = useState(1)`
  - **Required early return in App.jsx render function, BEFORE the stepper or header renders:**
    ```jsx
    if (typeof window !== 'undefined' && window.location.pathname === '/dev-dashboard') {
      return <DevDashboard />
    }
    ```
- **acceptance_criteria**:
  - `NavigationStepper.test.jsx`: clicking each of the 6 step labels calls `setActiveStep(n)` with the correct index 1–6
  - `src/App.test.jsx`: mounting `<App />` with `window.location.pathname = '/dev-dashboard'` renders DevDashboard and `screen.queryByRole('navigation', { name: /workflow|stepper/i })` returns `null`
  - The header (bead-02) is also NOT rendered on `/dev-dashboard`
  - When `activeStep` changes, content area swaps; step 1's placeholder text ("Casting") differs from step 6's ("Portfolio")
- **test_plan**:
  - `src/components/NavigationStepper.test.jsx` (new)
  - Extend `src/App.test.jsx` with the /dev-dashboard guard test
- **depends_on**: [`arch.app.project-header`]
- **blocks**: [`arch.step1.casting-container`, `arch.share.url-v3`, `arch.workspace.persist`]
- **risk**: Low (placeholder step content; real containers come later)
- **rollback**: `git restore src/App.jsx && rm -rf src/components/NavigationStepper.*`

---

### Bead-04: Step 1 — Casting + Actor Bank container with sub-tabs

- **id**: `arch.step1.casting-container`
- **title**: Build Step 1 container with three sub-tabs (Casting Pipeline, Character Builder, Actor Bank); wire activeCharId / activeEntityId / activeBankSlug state
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/CastingStepContainer.jsx`
  - `[NEW] src/components/CastingStepContainer.module.css`
  - `[NEW] src/components/CastingStepContainer.test.jsx`
  - `[MODIFY] src/App.jsx` — add `activeCharId`, `activeEntityId`, `activeBankSlug` state; mount CastingStepContainer when `activeStep === 1`
- **out_of_scope**:
  - Modifying the inner components (`CastingPipelinePanel`, `CharacterBuilder`, `ActorBankView`) — wire them in unchanged
  - Bead-05 (cross-tab bridge) handles the "Open in Casting Room" jump-in
- **api_contract**:
  - `<CastingStepContainer activeProjectId activeCharId setActiveCharId activeEntityId setActiveEntityId activeBankSlug setActiveBankSlug activeSubTab setActiveSubTab onNext />`
  - `activeSubTab` is `'casting-pipeline' | 'character-builder' | 'actor-bank'`, default `'casting-pipeline'`
  - Selecting a character in any sub-tab calls all of `setActiveCharId`, `setActiveEntityId` (if entity exists for char), `setActiveBankSlug` (if originated from bank)
- **acceptance_criteria**:
  - `screen.getByRole('tab', { name: /Casting Pipeline/i })` exists when `activeStep === 1`
  - `screen.getByRole('tab', { name: /Character Builder/i })` exists when `activeStep === 1`
  - `screen.getByRole('tab', { name: /Actor Bank/i })` exists when `activeStep === 1`
  - Clicking a character row in any sub-tab calls `setActiveCharId` with the character's ID
  - "Next Step" button advances `activeStep` to 2 only when `activeCharId` is non-null; disabled otherwise
- **test_plan**:
  - `CastingStepContainer.test.jsx`: mount with mocked context, click each sub-tab, simulate character selection, assert state setters called
- **depends_on**: [`arch.app.stepper-shell`]
- **blocks**: [`arch.step1.cross-tab-bridge`, `arch.step2.bible-container`]
- **risk**: Low
- **rollback**: `git restore src/App.jsx && rm -rf src/components/CastingStepContainer.*`

---

### Bead-05: Cross-tab bridge — Actor Bank "Open in Casting Room" lands on sub-tab

- **id**: `arch.step1.cross-tab-bridge`
- **title**: Migrate the legacy `jumpToCharacterId` bridge to set activeCharId + activeStep=1 + casting sub-tab atomically
- **priority**: P1
- **files_in_scope**:
  - `[MODIFY] src/components/ActorBank/ActorBankView.jsx`
  - `[MODIFY] src/components/CastingStepContainer.jsx`
  - `[NEW or extend] src/components/ActorBank/ActorBankView.test.jsx`
- **out_of_scope**:
  - Adding new bridges from other panels
- **api_contract**:
  - Existing "Open in Casting Room" button in `ActorBankView` now calls a single handler that updates three things in one render commit: `setActiveCharId(id)`, `setActiveStep(1)`, `setCastingSubTab('casting-pipeline')`
- **acceptance_criteria**:
  - `ActorBankView.test.jsx`: rendering with a mock character, clicking "Open in Casting Room", asserting all three setters are called with the correct values in the same act() block
  - No setter is called twice
  - The bridge no longer reads or writes `localStorage` key `castingRoomJumpId` (if it did before, that's legacy state — remove)
- **test_plan**:
  - `ActorBankView.test.jsx` with the atomic-set assertion
- **depends_on**: [`arch.step1.casting-container`]
- **blocks**: [`arch.step2.bible-container`]
- **risk**: Low
- **rollback**: `git restore src/components/ActorBank/ActorBankView.jsx src/components/CastingStepContainer.jsx`

---

### Bead-06: Step 2 — Bible Editor + Visual Anchor + Lift CTA

- **id**: `arch.step2.bible-container`
- **title**: Step 2 container integrates BibleEditor, VisualAnchorPicker, and the manual Lift-to-Bible-Context CTA
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/BibleStepContainer.jsx`
  - `[NEW] src/components/BibleStepContainer.module.css`
  - `[NEW] src/components/BibleStepContainer.test.jsx`
  - `[MODIFY] src/App.jsx` — mount BibleStepContainer when `activeStep === 2`
- **out_of_scope**:
  - Modifying `src/features/bible/BibleEditor.jsx` internals
  - Modifying `src/components/VisualAnchorPicker.jsx` internals
  - Automatic / silent lifting
- **api_contract**:
  - `<BibleStepContainer activeCharId activeEntityId setActiveEntityId activeBankSlug onNext onPrev />`
  - When `activeCharId` is null: empty state "Select a character in Step 1 first." with a button that calls `setActiveStep(1)`
  - When `activeCharId` set but `activeEntityId` null: prominent "Lift to Bible Context" CTA that POSTs to `/api/entities/lift-from-bank-entry` (existing endpoint) with `bankEntrySlug`, sets `activeEntityId` from response, then renders the editor
  - When `activeEntityId` set: side-by-side layout of `<BibleEditor entityId={activeEntityId} />` and `<VisualAnchorPicker entityId={activeEntityId} />`
- **acceptance_criteria**:
  - Empty state renders when `activeCharId` is null (`screen.getByText(/select a character/i)`)
  - Lift CTA renders when `activeCharId` set and `activeEntityId` null (`screen.getByRole('button', { name: /lift to bible context/i })`)
  - Clicking Lift CTA fires `fetch('/api/entities/lift-from-bank-entry', ...)` with `bankEntrySlug` in the body
  - After lift completes, `setActiveEntityId` is called with the returned ID
  - When `activeEntityId` is set, `<BibleEditor>` and `<VisualAnchorPicker>` are both in the DOM
- **test_plan**:
  - `BibleStepContainer.test.jsx` covers all four states (no char / char-no-entity / lifting / fully loaded), with `fetch` mocked
- **depends_on**: [`arch.step1.cross-tab-bridge`]
- **blocks**: [`arch.step3.extrapolation-container`]
- **risk**: Low
- **rollback**: `git restore src/App.jsx && rm -rf src/components/BibleStepContainer.*`

---

### Bead-07: Step 3 — Extrapolation + Review + Conflict + QA

- **id**: `arch.step3.extrapolation-container`
- **title**: Step 3 container integrates EntityExtrapolationPanel, AttributeReviewPanel, EntityConflictPanel, EntityContinuityQaPanel
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/ExtrapolationStepContainer.jsx`
  - `[NEW] src/components/ExtrapolationStepContainer.module.css`
  - `[NEW] src/components/ExtrapolationStepContainer.test.jsx`
  - `[MODIFY] src/App.jsx` — mount when `activeStep === 3`
- **out_of_scope**:
  - Modifying any of the four inner panels
  - Adding new extrapolation stages or modifying parsers
- **api_contract**:
  - `<ExtrapolationStepContainer activeEntityId onNext onPrev />`
  - Layout: extrapolation panel + streaming log on the left; review / conflict / QA panels stacked on the right
  - Empty state when `activeEntityId` is null: "Lift a character to Bible Context in Step 2 first." with a button that calls `setActiveStep(2)`
- **acceptance_criteria**:
  - Empty state renders when `activeEntityId` is null
  - When `activeEntityId` set, all four panels (`EntityExtrapolationPanel`, `AttributeReviewPanel`, `EntityConflictPanel`, `EntityContinuityQaPanel`) are queryable by their existing display labels
- **test_plan**:
  - `ExtrapolationStepContainer.test.jsx`: mount with and without `activeEntityId`, assert empty state vs. panels
- **depends_on**: [`arch.step2.bible-container`]
- **blocks**: [`arch.polish.bible-context`]
- **risk**: Low
- **rollback**: `git restore src/App.jsx && rm -rf src/components/ExtrapolationStepContainer.*`

---

### Bead-08: Share URL v3 — encode active step + active character

- **id**: `arch.share.url-v3`
- **title**: Bump share URL serializer to v3 with activeStep + activeCharId + activeProjectId; backward-compatible decode for v1 and v2
- **priority**: P1
- **files_in_scope**:
  - `[MODIFY] src/context/ShareLinkContext.jsx`
  - `[NEW] src/context/ShareLinkContext.test.jsx`
- **out_of_scope**:
  - Server-side share storage (none today; URL hash only)
  - UI changes
- **api_contract**:
  - v3 payload shape: `{ v: 3, step, projectId, charId, entityId, bankSlug, scene, dirKey, chars, scenario, chips, blend, narrativeBeat }`
  - Decode: detect `v` field; route to v1, v2, or v3 decoder
  - Encode: always produce v3
  - URL hash precedence: when `window.location.hash` starts with `#state=`, decoded payload overrides any `localStorage` state on initial mount
- **acceptance_criteria**:
  - Decoder test: pass a v1 fixture → v1 fields populated, new fields default; same for v2; v3 fixture round-trips
  - URL hash precedence test: with both hash and localStorage populated, the resulting state matches the hash
- **test_plan**:
  - `ShareLinkContext.test.jsx` with v1/v2/v3 fixtures and the hash-precedence test
- **depends_on**: [`arch.app.stepper-shell`]
- **blocks**: [] (independent enhancement)
- **risk**: Low — additive
- **rollback**: `git restore src/context/ShareLinkContext.jsx && rm -f src/context/ShareLinkContext.test.jsx`

---

### Bead-09: Workspace persistence under `qpb.workflow.v1`

- **id**: `arch.workspace.persist`
- **title**: Persist Prompt Studio workspace state to localStorage under key `qpb.workflow.v1`
- **priority**: P1
- **files_in_scope**:
  - `[MODIFY] src/context/WorkspaceContext.jsx`
  - `[NEW] src/context/WorkspaceContext.test.jsx`
- **out_of_scope**:
  - Changing the share URL format (that's bead-08)
  - Changing the existing SQLite-backed workspace profile snapshot feature
- **api_contract**:
  - On every workspace state change, debounced write to `localStorage.setItem('qpb.workflow.v1', JSON.stringify(state))`
  - On provider mount, read from `localStorage.getItem('qpb.workflow.v1')`, parse safely (try/catch), seed state if valid
  - Persisted fields (exact list): `scene`, `dirKey`, `charCount`, `chars`, `scenario`, `chips`, `blend`, `narrativeBeat`, `activeProjectId`, `activeCharId`
  - NOT persisted: `activeEntityId` (derived from char), `activeBankSlug` (derived), `activeStep` (UX choice — fresh load starts at 1 or wherever the URL hash says)
- **acceptance_criteria**:
  - `WorkspaceContext.test.jsx`: mocking localStorage, asserting `setItem('qpb.workflow.v1', ...)` is called within 1s of a scene change (use fake timers)
  - On second mount, state is restored from localStorage
  - Malformed JSON in localStorage is caught and ignored (no throw on mount)
- **test_plan**:
  - `WorkspaceContext.test.jsx` with mocked localStorage and fake timers
- **depends_on**: [`arch.app.stepper-shell`]
- **blocks**: [] (independent enhancement)
- **risk**: Low
- **rollback**: `git restore src/context/WorkspaceContext.jsx && rm -f src/context/WorkspaceContext.test.jsx`

---

### Bead-10: POST /api/polish — accept entityId, inject Bible context

- **id**: `arch.polish.bible-context`
- **title**: Add optional `entityId` to /api/polish request; inject character bible attributes as an appended block in the system message; preserve v1 prompt byte-equal
- **priority**: P0
- **files_in_scope**:
  - `[MODIFY] api/lib/polishCore.js`
  - `[MODIFY] api/polish.js` (Zod schema)
  - `[MODIFY or NEW] api/lib/polishCore.test.js`
- **out_of_scope**:
  - Touching `api/lib/prompts/library/polish.system.v1.prompt.md` — pinned, byte-equal
  - Frontend changes (bead-11 wires the UI call)
- **api_contract**:
  - Request shape diff (Zod):
    ```diff
     const polishRequestSchema = z.object({
       fragments: z.array(z.string()).min(1),
       directorName: z.string().optional(),
       scene: z.string().optional(),
       // ... existing optional fields
    +  entityId: z.string().uuid().optional(),
    +  projectId: z.string().optional(),
     })
    ```
  - When `entityId` is present:
    1. Open SQLite db via existing helper
    2. Call `projectBibleNested(db, entityId)` (existing function in `api/lib/bibles/projection.js`)
    3. Render an appended block in markdown, NOT modifying the v1 prompt source file
    4. Concatenate: `systemMessage = renderedV1Prompt + '\n\n' + bibleContextBlock`
  - When `entityId` is absent: behavior unchanged from current implementation
- **acceptance_criteria**:
  - **Byte-equal snapshot test**: read `api/lib/prompts/library/polish.system.v1.prompt.md`, compute SHA-256, assert it equals `<HASH FROM YOUR LOCAL VERIFICATION — see "Before you start" section>`. If hash drifts, the test fails with a diff-style error message.
  - **Injection test**: invoke `runPolish` with a mock provider that captures the system message; pass an `entityId` whose attributes are seeded in a test DB; assert the system message contains the substring `### Character Bible Reference` AND at least one injected attribute value
  - **No-entity test**: invoke `runPolish` without `entityId`; assert the system message does NOT contain `### Character Bible Reference`
  - Schema validation test: posting `entityId` with a non-UUID string returns 400
- **test_plan**:
  - `api/lib/polishCore.test.js` covers all four assertions above
- **depends_on**: [`arch.step3.extrapolation-container`]
- **blocks**: [`arch.step4.prompt-studio`]
- **risk**: Medium — touches the central polish path; mistakes will affect all polish calls
- **rollback**: `git restore api/lib/polishCore.js api/polish.js api/lib/polishCore.test.js`

**Implementation notes**:
- Use the **exact key paths from your verified characterBible.schema.js** (see "Before you start"). Strip any unverified keys from this list.
- The bible context block format should be:
  ```
  ### Character Bible Reference
  Use the following attributes as authoritative ground truth for this character.

  - demographics.gender: <value>
  - physical.face: <value>
  - wardrobe.everyday: <value>
  (etc.)
  ```
- Skip keys whose value is null, undefined, or empty string — don't inject `physical.eyes: undefined`.

---

### Bead-11: Step 4 — Cinematic Prompt Studio UI

- **id**: `arch.step4.prompt-studio`
- **title**: Step 4 container with existing prompt-builder inputs (scene, directors, chips) and polish controls; polish call includes activeEntityId when set
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/PromptStudioStep.jsx`
  - `[NEW] src/components/PromptStudioStep.module.css`
  - `[NEW] src/components/PromptStudioStep.test.jsx`
  - `[MODIFY] src/App.jsx` — mount when `activeStep === 4`
  - `[MODIFY] src/hooks/usePolish.js` — accept and forward `entityId`
- **out_of_scope**:
  - Modifying `PromptOutput.jsx` internals beyond what's needed to forward `entityId`
  - Bible Quick-Ref panel (that's bead-12)
- **api_contract**:
  - `<PromptStudioStep activeProjectId activeEntityId onNext onPrev />` — reads scene/dirKey/chips from WorkspaceContext
  - When user clicks Polish: `usePolish().polish({ ...payload, entityId: activeEntityId || undefined })`
- **acceptance_criteria**:
  - Scene textarea is rendered (`screen.getByRole('textbox', { name: /scene/i })`)
  - Director selector renders
  - Chips section renders
  - Polish button click: mocked fetch called once with body containing `entityId` when `activeEntityId` is set; body does NOT contain `entityId` field at all when null
- **test_plan**:
  - `PromptStudioStep.test.jsx` with WorkspaceContext provider mock and fetch mock
- **depends_on**: [`arch.polish.bible-context`]
- **blocks**: [`arch.step4.bible-quickref`, `arch.step5.render-studio`]
- **risk**: Low — composing existing components
- **rollback**: `git restore src/App.jsx src/hooks/usePolish.js && rm -rf src/components/PromptStudioStep.*`

---

### Bead-12: Step 4 — Bible Quick-Ref side panel

- **id**: `arch.step4.bible-quickref`
- **title**: Read-only side panel in Step 4 showing character bible attributes; sourced from same projection as bead-10
- **priority**: P1
- **files_in_scope**:
  - `[NEW] src/components/BibleQuickRef.jsx`
  - `[NEW] src/components/BibleQuickRef.module.css`
  - `[NEW] src/components/BibleQuickRef.test.jsx`
  - `[MODIFY] src/components/PromptStudioStep.jsx` — mount BibleQuickRef as a collapsible right-side drawer
- **out_of_scope**:
  - Editing bible from this panel (read-only; edits happen in Step 2)
  - Modifying `/api/bibles/:entityId` endpoint
- **api_contract**:
  - `<BibleQuickRef entityId />` fetches `/api/bibles/:entityId` (existing endpoint), renders a flat list of populated attributes
  - When `entityId` is null: renders nothing (the parent decides empty-state messaging)
  - When fetch fails: shows "Unable to load Bible" with a retry button
- **acceptance_criteria**:
  - Test renders with `entityId` set, mocked fetch returning a bible with `physical.face`, `wardrobe.everyday`, etc., assert at least 3 attribute rows in the DOM
  - Test that the toggle/collapse button changes the rendered state
  - Confirm zero render output when `entityId` is `null` or `undefined`
- **test_plan**:
  - `BibleQuickRef.test.jsx`
- **depends_on**: [`arch.step4.prompt-studio`]
- **blocks**: [`arch.step5.render-studio`]
- **risk**: Low
- **rollback**: `git restore src/components/PromptStudioStep.jsx && rm -rf src/components/BibleQuickRef.*`

---

### Bead-13: Step 5 — Comfy Render Studio

- **id**: `arch.step5.render-studio`
- **title**: Step 5 container with positive/negative prompts, workflow selector, render trigger, queue monitor
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/RenderStudioStep.jsx`
  - `[NEW] src/components/RenderStudioStep.module.css`
  - `[NEW] src/components/RenderStudioStep.test.jsx`
  - `[MODIFY] src/App.jsx` — mount when `activeStep === 5`
- **out_of_scope**:
  - Snapshot A/B comparison (bead-14)
  - Curation (beads 15–16)
- **api_contract**:
  - `<RenderStudioStep activeProjectId activeCharId polishedPrompt onNext onPrev />`
  - Reads ComfyUI status from `EmbeddedHealthContext`
  - Queue render via existing `/api/comfy/queue` or equivalent (verify endpoint name in your tree)
  - Empty state when `polishedPrompt` is empty: "Polish a prompt in Step 4 first."
  - Empty state when Comfy is offline: "ComfyUI is not connected." with diagnostic link
- **acceptance_criteria**:
  - Two textareas (positive prompt, negative prompt) rendered
  - Workflow selector renders dynamically from `/api/comfy-workflows` (mock the fetch)
  - Render button click fires mocked queue endpoint with positive + negative prompt + workflow ID
  - Status badge reflects mocked `EmbeddedHealthContext.comfyStatus`
- **test_plan**:
  - `RenderStudioStep.test.jsx` with mocked context and fetch
- **depends_on**: [`arch.step4.bible-quickref`]
- **blocks**: [`arch.step5.ab-compare`, `arch.step6.portfolio-ui`]
- **risk**: Low
- **rollback**: `git restore src/App.jsx && rm -rf src/components/RenderStudioStep.*`

---

### Bead-14: Step 5 — Snapshot A/B Compare

- **id**: `arch.step5.ab-compare`
- **title**: Sub-tab in Step 5 showing two renders side-by-side with prompt and parameter diff
- **priority**: P1
- **files_in_scope**:
  - `[NEW] src/components/SnapshotCompare.jsx`
  - `[NEW] src/components/SnapshotCompare.module.css`
  - `[NEW] src/components/SnapshotCompare.test.jsx`
  - `[MODIFY] src/components/RenderStudioStep.jsx` — add sub-tab nav between "Studio" and "A/B Compare"
- **out_of_scope**:
  - Approve/reject actions (those live in Step 6)
  - Persisting comparison selections beyond session
- **api_contract**:
  - `<SnapshotCompare activeProjectId activeCharId />` loads recent renders via `/api/generated-images` (verify endpoint name) filtered by `activeCharId`
  - Two selectors (A and B); when both selected, side-by-side images + parameter diff
  - Diff style: green for B-only, red for A-only on prompt token comparison
- **acceptance_criteria**:
  - Sub-tab toggle in RenderStudioStep switches between studio and compare views
  - Selecting two snapshots renders both images in the DOM
  - Prompt diff: when A's prompt is "foo bar" and B's prompt is "foo baz", "bar" has a `data-diff="removed"` attribute and "baz" has `data-diff="added"` (or equivalent)
- **test_plan**:
  - `SnapshotCompare.test.jsx` with mocked images endpoint
- **depends_on**: [`arch.step5.render-studio`]
- **blocks**: [`arch.step6.portfolio-ui`]
- **risk**: Low
- **rollback**: `git restore src/components/RenderStudioStep.jsx && rm -rf src/components/SnapshotCompare.*`

---

### Bead-15: Step 6 — Portfolio review UI

- **id**: `arch.step6.portfolio-ui`
- **title**: Step 6 container with Approved / All Renders sub-tabs and approve/reject controls
- **priority**: P0
- **files_in_scope**:
  - `[NEW] src/components/CurationPortfolio.jsx`
  - `[NEW] src/components/CurationPortfolio.module.css`
  - `[NEW] src/components/CurationPortfolio.test.jsx`
  - `[MODIFY] src/App.jsx` — mount when `activeStep === 6`
- **out_of_scope**:
  - CSV export (bead-16)
  - Modifying any approval API endpoint
- **api_contract**:
  - `<CurationPortfolio activeProjectId activeCharId onPrev />`
  - Two sub-tabs: "Approved" (filter to approved renders) and "All Renders" (everything)
  - Approve button calls existing approve endpoint
  - Reject button calls existing reject endpoint
  - Empty state when `activeCharId` is null
- **acceptance_criteria**:
  - Sub-tab toggle works (`screen.getByRole('tab', { name: /approved/i })` and `/all renders/i`)
  - Approve button click fires mocked endpoint with image ID
  - Reject button click fires mocked endpoint with image ID
- **test_plan**:
  - `CurationPortfolio.test.jsx`
- **depends_on**: [`arch.step5.ab-compare`]
- **blocks**: [`arch.step6.export`]
- **risk**: Low
- **rollback**: `git restore src/App.jsx && rm -rf src/components/CurationPortfolio.*`

---

### Bead-16: Step 6 — CSV export

- **id**: `arch.step6.export`
- **title**: Add "Export portfolio (CSV)" button to CurationPortfolio that downloads ID/Character/Seed/Workflow/Prompts
- **priority**: P2
- **files_in_scope**:
  - `[MODIFY] src/components/CurationPortfolio.jsx`
  - `[MODIFY or extend] src/components/CurationPortfolio.test.jsx`
- **out_of_scope**:
  - Server-side ZIP packaging
  - Image bundling
- **api_contract**:
  - Button click generates a CSV string client-side from the loaded renders, creates a Blob, triggers download via temporary anchor element
  - Columns (exact order): `id, character_name, seed, workflow, positive_prompt, negative_prompt, created_at`
- **acceptance_criteria**:
  - Test mocks `HTMLAnchorElement.prototype.click` and asserts: button click creates an anchor with `href` starting with `blob:` or `data:text/csv`, and click is fired
  - Assert the Blob content (or the data URI body) contains the column header row + at least one data row matching mocked renders
- **test_plan**:
  - `CurationPortfolio.test.jsx` extended
- **depends_on**: [`arch.step6.portfolio-ui`]
- **blocks**: [`arch.aesthetic.polish`]
- **risk**: Low
- **rollback**: `git restore src/components/CurationPortfolio.jsx src/components/CurationPortfolio.test.jsx`

---

### Bead-17: Aesthetic polish

- **id**: `arch.aesthetic.polish`
- **title**: Glassmorphic stepper, gold accents, transitions across step containers
- **priority**: P2
- **files_in_scope**:
  - `[MODIFY] src/components/NavigationStepper.module.css`
  - `[MODIFY] src/App.module.css`
  - `[MODIFY] each step container's `.module.css` from beads 04, 06, 07, 11, 13, 15
- **out_of_scope**:
  - Any JSX changes
  - Any new components
  - Any behavior changes
- **api_contract**: none (CSS-only)
- **acceptance_criteria**:
  - All existing tests still pass (no JSX touched)
  - Visual review by user (no automated assertion required)
- **test_plan**:
  - `npx vitest run` — zero new failures vs. `main` immediately before this bead
- **depends_on**: [`arch.step6.export`]
- **blocks**: [`arch.devdash.e2e`]
- **risk**: Low — pure CSS
- **rollback**: `git restore src/components/*.module.css src/App.module.css`

---

### Bead-18: Dev Dashboard pipeline group + E2E navigation test

- **id**: `arch.devdash.e2e`
- **title**: Add Pipeline group to DevDashboard.jsx with health checks for each step container; write E2E test that clicks Step 1 → Step 6 sequentially without console errors
- **priority**: P0
- **files_in_scope**:
  - `[MODIFY] src/DevDashboard.jsx`
  - `[NEW] src/DevDashboard.test.jsx`
- **out_of_scope**:
  - Modifying core App.jsx routing (the /dev-dashboard guard is in bead-03)
  - Adding new test runner / framework
- **api_contract**:
  - Pipeline group in DevDashboard surfaces: Step 1 container mounts, Step 2 mounts, Step 3 mounts, Step 4 polish endpoint responds, Step 5 Comfy connection, Step 6 portfolio loads
- **acceptance_criteria**:
  - `DevDashboard.test.jsx`: mount the full App, click each step in order from 1 to 6, assert the corresponding step container's distinguishing text is in the DOM at each step
  - Test fails if `console.error` is called at any point during navigation
  - `/dev-dashboard` smoke test re-asserted: at the route, stepper is NOT in DOM
- **test_plan**:
  - `DevDashboard.test.jsx`
  - Final full-suite run: `npx vitest run` — all tests pass
- **depends_on**: [`arch.aesthetic.polish`]
- **blocks**: []
- **risk**: Medium — integration test surface
- **rollback**: `git restore src/DevDashboard.jsx && rm -f src/DevDashboard.test.jsx`

---

## Appendix A: Dependency edges

```
arch.app.extract-contexts        → arch.app.project-header
arch.app.project-header          → arch.app.stepper-shell
arch.app.stepper-shell           → arch.step1.casting-container
arch.app.stepper-shell           → arch.share.url-v3
arch.app.stepper-shell           → arch.workspace.persist
arch.step1.casting-container     → arch.step1.cross-tab-bridge
arch.step1.cross-tab-bridge      → arch.step2.bible-container
arch.step2.bible-container       → arch.step3.extrapolation-container
arch.step3.extrapolation-container → arch.polish.bible-context
arch.polish.bible-context        → arch.step4.prompt-studio
arch.step4.prompt-studio         → arch.step4.bible-quickref
arch.step4.bible-quickref        → arch.step5.render-studio
arch.step5.render-studio         → arch.step5.ab-compare
arch.step5.ab-compare            → arch.step6.portfolio-ui
arch.step6.portfolio-ui          → arch.step6.export
arch.step6.export                → arch.aesthetic.polish
arch.aesthetic.polish            → arch.devdash.e2e
```

Critical path: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 (16 beads).
Parallel: 08 (share URL) and 09 (workspace persist) can run after 03 in parallel with the step container chain.

## Appendix B: Deferred / explicitly out of scope

- Backend endpoint changes beyond `POST /api/polish` (bead-10)
- Schema migrations
- New extrapolation stages or stage prompts
- Per-character LoRA training
- IPAdapter chain implementation (no Qwen-Image support today)
- Project CRUD UI
- Multi-user authentication / cloud deployment
- ZIP / image bundle exports (only CSV in bead-16)
- Mobile responsive layout
- Anything in `vite.config.js` — separate bead `qdrs` covers this

## Appendix C: What's NOT in this plan that you may want later

The architect-handoff-brief and comprehensive_review identified work outside the
UI redesign that is still open:

- `qdrs` — vite.config.js cleanup (already a bead in your tracker)
- `lnmb` — regression harness (already a bead in your tracker)
- Phase 6 + 7 work (Prompt Pack Compiler, IPAdapter canvas) — placeholders
- Bible schema completeness ring for Location and Era types — currently only
  Character has the schema
- Gap detection ("what's missing?") — depends on completeness function

None of these block the 18 beads above.
