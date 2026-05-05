---

### **Developer Implementation Notes & Recommendations**  
**Casting Room v2 Overhaul**

#### 1. High Priority Technical Changes

**Database**
- Add column to `characters` table:
  ```sql
  lifecycle_status ENUM('draft', 'auditioned', 'preview', 'portfolio_pending', 'ready', 'finalized', 'archived') 
  DEFAULT 'draft' NOT NULL;
  ```
- Add index on `lifecycle_status` + `archived`.

**New / Updated API Endpoints**
- `PATCH /api/characters/:id/lifecycle` — simple status updater (`patchCharacterLifecycle`)
- `GET /api/render-events` — SSE endpoint that broadcasts render completion events
- `POST /api/batch/previews` — trigger preview generation for approved batch candidates

---

#### 2. Key Recommendations

**1. Unified CharacterCard Component (Very Important)**
- Create one reusable `CharacterCard` component used in:
  - Path A audition results
  - Path B batch review
  - (Optionally) Active Character list
- Pass props for `mode` ("audition", "batch", "preview") to control which buttons are shown.
- This will greatly reduce UI bugs and inconsistency.

**2. Hybrid SSE + Polling Strategy**
- Implement SSE as primary (`/api/render-events`)
- On frontend, use `EventSource`
- Add a 20-second fallback interval that only runs if SSE is closed or disconnected
- When an SSE `render-update` event arrives, debounce it by 250ms then trigger the appropriate tick function (`auditTickRef` or `portfolioTickRef`)

**3. RenderStatusBar**
- Create as a separate component that listens to global render state.
- Show different messages:
  - "Rendering • 12/18 complete • Live" (SSE connected)
  - "Rendering • 12/18 complete • Polling" (fallback)
- Make it dismissible only when no active jobs remain.

**4. Lifecycle Status Handling**
- Create a small service (`characterLifecycle.js`) that centralizes all status transitions.
- Example:
  ```js
  approveFirstImage(characterId) → set to 'ready'
  queuePortfolio(characterId) → set to 'portfolio_pending'
  createViaPreview() → set to 'preview'
  ```

**5. Auto-Select + Scroll Behavior**
- After successful audition generation or batch save:
  1. Update active character in state
  2. Use `setTimeout(() => { document.getElementById('active-character').scrollIntoView({ behavior: 'smooth' }) }, 300)`
  3. Show toast with action button ("Generate Full Portfolio")

---

#### 3. Important Gotchas to Watch

- **Race conditions** — Keep using `ingestedRef` (Set) to prevent double-ingestion of images when both SSE and polling fire close together.
- **Stale closures** — Continue storing tick functions in `useRef` (you’re already doing this well).
- **Preview characters** — Make sure they are filtered out of the Active Character dropdown using `lifecycleStatus !== 'preview'`.
- **Generate Previews side effect** — Clearly document that clicking "Generate Previews" will save the shortlisted candidates to the `characters` table.
- **ComfyUI offline gracefulness** — Character profiles should still be created even if all renders fail.

---

#### 4. Suggested Order of Implementation (Phase 1)

1. Add `lifecycle_status` column + backend service
2. Create unified `CharacterCard` component
3. Implement SSE endpoint + frontend EventSource handler
4. Add RenderStatusBar
5. Auto-compile prompt packs on character creation
6. Implement "Approve + Portfolio" + auto-scroll + toast
7. Build Generate Previews flow for Path B
8. Polish all status transitions

---

#### 5. Nice-to-Have Improvements (Phase 2)

- Add `last_rendered_at` timestamp on characters
- Add soft delete (`deleted_at`) instead of hard archive
- Create a global render job store (Zustand or Redux) instead of spreading state across multiple `useState` hooks
- Add retry logic for failed ComfyUI jobs

---