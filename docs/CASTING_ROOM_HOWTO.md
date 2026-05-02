# Casting Room — Step-by-Step User Guide

This guide walks you through both casting workflows end-to-end.

- **Journey A — Cast from Bank**: Generate audition candidates directly from a Character Bank entry using LM Studio. The fastest path to seeing generated images.
- **Journey B — Batch Pipeline**: Review a pre-generated batch of character candidates, approve or reject them, then promote to an Active Character.

Both journeys converge at the **Active Character → Portfolio → Gallery** stage.

---

## Prerequisites

Before opening the Casting Room, make sure these are in place:

| Requirement | How to check |
|---|---|
| Dev server running | `npm run dev` → open http://localhost:5173 |
| LM Studio running | LM Studio app open, a model loaded and serving on its local port |
| `.env.local` has `LMSTUDIO_BASE_URL` | Points to LM Studio's API (e.g. `http://localhost:1234`) |
| `.env.local` has `LMSTUDIO_MODEL` | Set to the exact model name shown in LM Studio (e.g. `Gemma-4-E4B-...`) |
| ComfyUI running (for image generation) | ComfyUI app open and serving (default `http://localhost:8188`) |
| `.env.local` has `ENABLE_COMFY_API=true` | Required for ComfyUI integration; restart dev server after changing |
| `.env.local` has `COMFYUI_BASE_URL` | Points to ComfyUI (e.g. `http://localhost:8188`) |

> **Note**: Restart the dev server (`Ctrl+C` then `npm run dev`) after changing any `.env.local` values — the API is loaded as Vite middleware at startup and does not hot-reload.

> **Batch Pipeline only**: also requires `ENABLE_CHARACTER_BATCH_API=true` in `.env.local` and batches pre-generated via the API (`POST /api/characters-generate-batch`).

---

## Journey A — Cast from Bank

### Step 1: Create a Character Bank Entry

1. Click the **Character Builder** tab.
2. Fill in the character's **Name** (e.g. `Lena Sholk`).
3. Write a **Description** — describe their look, age, energy, and any casting notes. The richer this text, the better the LM Studio output.
4. Click **Save**. The character is now in the bank with a `@snake_case` slug (e.g. `@lena_sholk`).

> Slugs must be `snake_case` ASCII. The app auto-converts on save.

---

### Step 2: Open the Casting Room

Click the **Casting Room** tab. The panel loads:
- Character Bank entries (from the bank you just populated)
- Existing batches (Batch Pipeline section)
- ComfyUI workflow list

If you see a load error, check that the dev server is running and `.env.local` is correct.

---

### Step 3: Select a Character in "Cast from Bank"

Under **Cast from Bank**, open the dropdown and select your character. You will see their name and description preview below the dropdown.

If the dropdown shows "No bank characters yet", go back to Character Builder and save at least one entry.

---

### Step 4: Generate Auditions

1. Set **Count** (1–10, default 3). This is how many distinct actor candidates the LLM will generate.
2. Click **Generate Auditions**.
   - The button changes to **Generating…** while LM Studio creates character profiles.
   - Each profile is validated against the character schema. If a profile fails validation, that slot is skipped.
   - For each valid profile, two Comfy jobs are queued automatically: `front portrait` and `profile portrait`.
3. When generation finishes you see results like:
   ```
   3 generated · 0 failed
   images appear automatically when ready
   ```

> **What happens under the hood**: The app calls LM Studio with a structured prompt that includes your bank entry's name and description. LM Studio returns N character profiles as JSON. Each profile is saved to the database as a new character, then two ComfyUI prompt packs are compiled and queued.

---

### Step 5: Watch Images Appear Automatically

After generation, the **⟳ checking Comfy…** indicator appears. The app polls ComfyUI every 8 seconds.

Each candidate pair shows:
- A short pair ID and character ID
- One card per view (`front portrait`, `profile portrait`)
- A status badge per view:
  - **⟳ pending** — job queued, not started
  - **⟳ running…** — ComfyUI is rendering
  - **✓ ready** — image generated and ingested
  - **✗ failed** — ComfyUI job failed

When a job succeeds, the image is automatically ingested and appears inline. You do not need to click anything.

Polling stops automatically once all jobs are in a terminal state (`success` or `failed`).

---

### Step 6: Approve or Reject Each View

Under each view card you will see **Approve** and **Reject** buttons.

- **Approve** — marks this view's audition record as approved.
- **Reject** — opens a prompt for an optional rejection reason, then marks it rejected.

You can approve and reject independently per view within the same candidate pair.

---

### Step 7: Request More Takes (optional)

After you approve at least one view in a candidate pair, a **More takes** panel appears below that pair.

1. Tick the views you want (checkboxes for all 6 view types: `front portrait`, `three quarter portrait`, `profile portrait`, `full body`, `audition still`, `cinematic scene`).
2. Click **Queue Takes**.
3. The new jobs are queued and the existing audit poller picks them up — progress appears as `N/total ready`.

> "More takes" uses the same character profile already saved to the database. It simply compiles new prompt packs for the chosen views and queues them.

---

## Journey B — Batch Pipeline

This path assumes batches have been generated via the API (e.g. via `POST /api/characters-generate-batch` with `persistBatch: true`). If no batches exist, the section shows "No batches found."

---

### Step 1: Select a Batch

Under **Batch Pipeline**, open the dropdown. Each entry shows a short batch ID and its status (e.g. `pending`, `complete`).

Select a batch. The list of candidates loads below.

---

### Step 2: Review Candidates

Each candidate card shows:
- **Name** and **age**
- **Review status** (e.g. `pending`, `approved`, `rejected`)
- **Classification** (e.g. `accepted`, `needsMutation`, `rejected` — set by the similarity check at generation time)
- **Cinematic archetype** (a one-line descriptor from the LLM)

For each candidate, choose:
- **Approve** — moves `reviewStatus` to `approved`
- **Reject** — moves `reviewStatus` to `rejected`

---

### Step 3: Save as Active Character

Once a candidate is approved, the **Save → Active Character** button becomes enabled.

Click it. The candidate's character profile is saved to the database, and the **Active Character** section auto-selects it. You will see a success banner: `Saved as Active Character: <name>`.

---

## Active Character → Portfolio → Gallery

Both journeys converge here. You now have a character in the database and can generate a full portfolio.

---

### Step 4: Compile Prompt Packs

Under **Active Character**:

1. The dropdown shows all saved characters (name, age, short ID). Your newly saved character should be selected.
2. Click **Compile Prompt Packs**. The app compiles one prompt pack per view for this character using the selected ComfyUI workflow, then lists them.
3. A success banner shows `Compiled N prompt pack(s).`

> If you already compiled packs in a previous session, click **Load Existing** instead to reload without recompiling.

---

### Step 5: Queue the Portfolio

Under **Portfolio**:

1. Select a **Workflow** from the dropdown. Only valid workflows appear by default — tick "show invalid" to see all.
2. Tick the **views** you want to generate. Default selection is:
   - `front portrait` ✓
   - `three quarter portrait` ✓
   - `profile portrait` ✓
   - `full body` ✓
   - `audition still` ✓
   - `cinematic scene` ☐ (off by default — slow/heavy)
3. Click **Queue Portfolio**.
4. The **⟳ checking Comfy…** indicator appears and the job list shows status badges for each queued view.

Images are automatically ingested as jobs succeed. The poller stops when all jobs are terminal.

---

### Step 6: Review the Gallery

Under **Gallery**:

1. Images for the active character appear automatically as they are ingested. Click **Refresh** to reload manually.
2. Each image card shows:
   - View type (e.g. `front_portrait`)
   - Seed number
   - Approval status (`pending` or `✓`)
3. Click **Approve** or **Reject** for each image to record your decision.

---

## Developer Tools

The **▸ Developer Tools** section is collapsed by default. Expand it when troubleshooting.

| Tool | What it does |
|---|---|
| **Comfy status** | Shows whether ComfyUI is reachable and its base URL |
| **Refresh Panel** | Re-fetches all panel data (batches, workflows, characters) |
| **Validate Workflow** | Runs a validation check on the selected workflow and prints the result |
| **Dry-run Pack** | Compiles a prompt pack and sends it to the ComfyUI workflow without queuing — useful to check the prompt text |
| **Queue Single Pack** | Queues exactly one prompt pack and prints the returned Comfy prompt ID |
| **Check Job Status** | Fetches status for the last queued prompt ID |
| **Ingest Outputs** | Manually ingests outputs for the last queued prompt ID into the gallery |

> Use **Dry-run Pack** first when testing a new workflow to verify the prompt mapping without burning a render slot.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Local LM Studio error: 400" | LM Studio does not accept `json_object` response format | LM Studio 0.3+ requires `json_schema`. Already patched in `api/lib/llm/providers/lmStudioProvider.js`. Restart dev server. |
| `qwenPromptSeed` validation error | Non-Qwen model returned a number for this field | Already patched: field is coerced or dropped. Restart dev server. |
| "Bank unavailable" in Cast from Bank | Bank entries failed to load | Check dev server logs. Ensure DB file exists (`api/db/` directory). |
| Images never appear (stuck at ⟳ pending) | ComfyUI not running or `COMFYUI_BASE_URL` wrong | Expand Developer Tools → check Comfy status line. |
| "BANK_ENTRY_NOT_FOUND" after Generate Auditions | Selected bank entry was deleted or DB was reset | Re-select a valid entry from the dropdown. |
| "Failed: schema_invalid" in audition results | LLM output missing required character fields | Try again — LLMs occasionally produce malformed JSON. The app retries per candidate. |
| Batch Pipeline shows "No batches found" | No batches have been generated yet | Generate batches via `POST /api/characters-generate-batch` with `persistBatch: true`. Requires `ENABLE_CHARACTER_BATCH_API=true`. |
| "Queue Portfolio" button disabled | No character selected, no workflow selected, or no views ticked | Check all three. |
