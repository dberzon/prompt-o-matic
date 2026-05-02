# Casting Room — Step-by-Step User Guide

Two casting workflows are available:

- **Journey A — Cast from Bank**: Pick a casting brief, click Generate Auditions. LM Studio produces character profiles; Comfy renders front and profile portraits automatically.
- **Journey B — Batch Pipeline**: Generate or select a batch of AI-produced candidates, review them, and promote the ones you want to a character profile.

Both journeys converge at **Active Character → Portfolio → Gallery**.

---

## Prerequisites

| Requirement | Required for | How to check |
|---|---|---|
| Dev server running | Both | `npm run dev` → open http://localhost:5173 |
| LM Studio running, model loaded | Journey A + Batch generation | LM Studio app open, serving on local port |
| `LMSTUDIO_BASE_URL` in `.env.local` | Journey A + Batch | Points to LM Studio (e.g. `http://localhost:1234`) |
| `LMSTUDIO_MODEL` in `.env.local` | Journey A + Batch | Exact model name shown in LM Studio |
| `ENABLE_COMFY_API=true` in `.env.local` | Image generation | Required for ComfyUI integration |
| `COMFYUI_BASE_URL` in `.env.local` | Image generation | Points to ComfyUI (e.g. `http://localhost:8188`) |
| `ENABLE_CHARACTER_BATCH_API=true` in `.env.local` | Journey B | Required to list/generate batches |

> **Restart the dev server** (`Ctrl+C` then `npm run dev`) after any `.env.local` change — the API loads as Vite middleware at startup and does not hot-reload.

---

## Journey A — Cast from Bank

### Step 1: Create a Casting Brief

1. Click the **Character Builder** tab.
2. Fill in **Name** (e.g. `Lena Sholk`) and a **Description** — the more specific the look, age, energy, and tone, the better the LM Studio output.
3. Click **Save**. The brief is stored with a `@snake_case` slug (e.g. `@lena_sholk`).

If the brief already exists, skip to Step 2.

---

### Step 2: Open the Casting Room

Click the **Casting Room** tab. The panel loads casting briefs, batches, and the ComfyUI workflow list.

If you see a load error check the dev server logs and verify `.env.local`.

---

### Step 3: Select a Brief and Workflow

Under **Cast from Bank**:

1. Pick your casting brief from the dropdown (`@slug — Name`). The name and description appear below as a preview.
2. Select a **workflow** from the dropdown below the brief selector. Only valid workflows appear by default. If the list is empty, ComfyUI isn't connected or no workflows are loaded.

---

### Step 4: Generate Auditions

1. Set **Count** (1–10, default 3) — how many distinct actor candidates the LLM generates.
2. Click **Generate Auditions**.
   - The LLM creates N character profiles from your brief.
   - Each profile is validated and saved to the database.
   - Two Comfy jobs are queued per candidate: `front portrait` and `profile portrait`.
3. The result summary appears: `N generated · M failed`.
4. A note confirms: *"Front portrait and profile portrait are queued for each candidate. To generate other views use Portfolio below — uncheck front and profile to avoid duplicates."*
5. The first successfully generated character is automatically selected in **Active Character**.

> If generation fails for all candidates, check the LM Studio log for errors and retry.

---

### Step 5: Watch Images Appear Automatically

After generation the **⟳ checking Comfy…** indicator appears. The panel polls ComfyUI every 8 seconds.

Each candidate pair shows status badges per view:
- **⟳ pending** — job queued, not started
- **⟳ running…** — ComfyUI is rendering
- **✓ ready** — image generated and ingested automatically
- **✗ failed** — ComfyUI job failed

Images appear inline as jobs complete. Polling stops when all jobs are terminal (success or failed).

> **Tab navigation**: job state is saved in `sessionStorage`. If you switch tabs and return, the panel restores pending jobs and resumes polling automatically.

---

### Step 6: Review Each View

Under each candidate pair you see one card per view. Once all jobs for a pair are terminal:

- **Select this look** — marks this specific view's audition record as selected.
- **Pass** — prompts for an optional reason, then marks it passed.

You can select and pass views independently within the same pair.

---

### Step 7: Request More Takes (optional)

Once all Comfy jobs for a pair finish (success or failed), a **More takes** panel appears below that pair — regardless of whether you have selected any view.

1. Tick the views you want (all 6 available: front portrait, three quarter portrait, profile portrait, full body, audition still, cinematic scene).
2. Click **Queue Takes**. New jobs are queued and the existing poller picks them up.
3. Progress shows as `N/total ready`.

---

## Journey B — Batch Pipeline

### Step 1: Generate or Select a Batch

Under **Batch Pipeline**:

- To create a new batch, click **+ Generate Batch**. Fill in:
  - **Age** range (min–max, e.g. 25–45)
  - **Count** (how many candidates to generate, 1–50)
  - **Gender** (mixed, male, female, non-binary)
  - **Tone** (optional — e.g. `gritty noir thriller`)
  - Click **Generate**. This calls LM Studio and may take 30–90 seconds. The batch list refreshes automatically on success.
- Or select an existing batch from the dropdown.

> Requires `ENABLE_CHARACTER_BATCH_API=true`. If the Generate button fails with a permissions error, add the flag to `.env.local` and restart.

---

### Step 2: Review Candidates

Each candidate card shows:
- **Name** and **age**
- **Review status**: `pending` / `approved` / `rejected`
- **Similarity check**: `unique` (safe to use), `needs change` (close to existing characters), `too similar` (auto-flagged as duplicate)
- **Cinematic archetype**

For each candidate:
- **Cast this character** — marks `reviewStatus` as approved.
- **Dismiss** — rejects the candidate.

---

### Step 3: Save as Active Character

Once a candidate is approved (review status: approved), the **Save → Active Character** button becomes enabled. Click it. The character is saved to the database and automatically selected in the **Active Character** section.

---

## Active Character → Portfolio → Gallery

Both journeys arrive here. You now have a character in the database.

---

### Step 1: Manage the Character (optional)

With the character selected in **Active Character**:

- **Rename** — click Rename, type a new name, press Enter or **Save name**.
- **Archive** — click Archive to hide the character from the dropdown without deleting it. Archived characters and their images remain in the database. Use the **▸ Archived characters** section below the dropdown to restore them.

---

### Step 2: Prompt Packs

When you select a character, the panel automatically checks for existing prompt packs and loads them. If packs exist, the button reads **Recompile Packs** (regenerates them). If no packs exist, it reads **Compile Prompt Packs** (generates for the first time).

> Journey A characters have their packs compiled during audition generation — they will usually appear immediately.

---

### Step 3: Queue the Portfolio

Under **Portfolio**:

1. The workflow dropdown shows the currently selected workflow (shared with Journey A's selector).
2. Tick the **views** to render. Default selection:
   - `front portrait` ✓
   - `three quarter portrait` ✓
   - `profile portrait` ✓
   - `full body` ✓
   - `audition still` ✓
   - `cinematic scene` ☐ (off by default)
3. **Journey A users**: front and profile portrait are already in the Gallery from Step 4. Uncheck them here to avoid duplicate renders.
4. Click **Queue Portfolio**.
5. **⟳ checking Comfy…** appears and each view shows a status badge. Images are ingested automatically as jobs complete.

---

### Step 4: Review the Gallery

Under **Gallery**:

The header shows **Showing images for: [Character Name]** so you always know whose images you're looking at. If you switch the Active Character dropdown, the gallery updates to show that character's images.

Each image card shows view type, seed, and approval state.

- **Keep** — marks the image as approved.
- **Discard** — rejects it with reason "Rejected manually".

Click **Refresh** to reload the gallery manually if needed.

---

## Developer Tools

Expand **▸ Developer Tools** (collapsed by default) for low-level access.

| Tool | Use when |
|---|---|
| **Comfy status** | Check whether ComfyUI is reachable |
| **Refresh Panel** | Re-fetch all batches, workflows, characters |
| **Validate Workflow** | Check a workflow mapping before rendering |
| **Dry-run Pack** | Preview the compiled prompt without queuing a job |
| **Queue Single Pack** | Queue exactly one prompt pack; returns the Comfy prompt ID |
| **Check Job Status** | Poll status for the last queued prompt ID |
| **Ingest Outputs** | Manually ingest outputs if auto-ingest failed |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Local LM Studio error: 400" | Older `json_object` response format | Already patched. Restart dev server. |
| `qwenPromptSeed` validation error | Non-Qwen model returned a number | Already patched. Restart dev server. |
| "No casting briefs yet" in Cast from Bank | No briefs saved | Go to Character Builder tab and save one. |
| Images never appear (stuck at ⟳ pending) | ComfyUI not running or wrong URL | Expand Developer Tools → check Comfy status line. |
| Generate Batch fails with permissions error | Feature flag missing | Add `ENABLE_CHARACTER_BATCH_API=true` to `.env.local`, restart. |
| Queue Portfolio button disabled | No character, no workflow, or no views ticked | Check all three. |
| Gallery shows images for wrong character | Active Character dropdown changed | Check "Showing images for:" label in gallery header. |
| Archived character missing from dropdown | Archived via the Archive button | Expand "▸ Archived characters" below the dropdown and click Restore. |
| Pending jobs not resuming after tab switch | sessionStorage cleared (private browsing?) | Use Developer Tools → Ingest Outputs manually, or reload and re-queue. |
