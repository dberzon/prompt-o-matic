# Qwen Prompt Builder — Full Guide

> **Last updated:** 2026-05-03
> Covers: recently completed work, full interface walkthrough, external services reference.

---

## Table of Contents

1. [What Was Recently Completed](#1-what-was-recently-completed)
2. [Application Interface](#2-application-interface)
   - [Tab 1 — Prompt Builder](#tab-1--prompt-builder)
   - [Tab 2 — Character Builder](#tab-2--character-builder)
   - [Tab 3 — Casting Room](#tab-3--casting-room)
   - [Tab 4 — Actor Bank](#tab-4--actor-bank)
3. [Full Workflow Walkthrough](#3-full-workflow-walkthrough)
   - [Journey A — Cast from Bank](#journey-a--cast-from-bank)
   - [Journey B — Batch Pipeline](#journey-b--batch-pipeline)
   - [Core Prompt Loop](#core-prompt-loop)
4. [External Services](#4-external-services)
5. [Environment Variables](#5-environment-variables)

---

## 1. What Was Recently Completed

The following work was completed in the most recent sessions (newest first).

---

### P4 — Flow Fixes and Documentation Sync (May 3 2026)

**Archive state migrated from localStorage to SQLite:**
- Added `archived_at` column to the `characters` table via auto-migration on startup.
- New API endpoints: `POST /api/character-archive` and `POST /api/character-restore`.
- `listCharacters` excludes archived characters by default; `?includeArchived=only` returns archived list.
- `casting_room_archived_chars` localStorage key is no longer used.

**Journey A promotion confirmed and UI feedback added:**
- Audit confirmed Journey A characters are created in the `characters` table at generation time and already appear in the Active Character dropdown.
- After clicking **Select this look**, the page now scrolls to the Active Character section and displays: *"Character ready — select them in Active Character ↓"*

**Journey B Dismiss made reversible:**
- Dismiss was already a soft-delete (status update only). Added UI controls to surface this.
- Dismissed candidates are now hidden by default; a **Show dismissed (N)** toggle reveals them.
- Each dismissed candidate shows a **Reconsider** button that resets its status to pending.
- New API endpoint: `POST /api/character-batch-candidate-reconsider`.

**Portfolio section shows arrival context:**
- Active Character → Portfolio section now shows conditional copy: if the character has existing gallery images, "Your candidate has audition images — queue Portfolio to add more views." If no images exist, "No images yet — queue Portfolio to generate this character's first set."

**Project tone field wired to LLM with tooltip:**
- The Tone field in the Journey B batch form now has a tooltip explaining what it does.
- The LLM batch generation prompt now gives explicit aesthetic guidance per tone value (cinematic, editorial, raw, gritty noir, etc.).

**Feature flags documented:**
- All five `ENABLE_*` feature flags in `.env.local` are now documented with descriptions in Section 5.

**Polling interval removed from user-facing copy:**
- References to "every 8 seconds" removed from `CASTING_ROOM_HOWTO.md` and this guide; polling indicator shows "⟳ checking Comfy…" with no interval specified.

---

### P3 — Character Management (May 3 2026)

**Character rename:**
- Characters in the Active Character panel can now be renamed inline.
- Click the character name, type a new name, press **Enter** to save or **Escape** to cancel.
- Persisted to the SQLite database via `POST /api/character-rename`.

**Character archive / restore:**
- An **Archive** button hides a character from the Active Character dropdown without deleting it.
- Archived characters appear in a collapsible "Archived characters" panel with a **Restore** button.
- Archive state is persisted to SQLite via an `archived_at` column — survives browser clears and is cloud-compatible.

**How-to guide rewritten:**
- `docs/CASTING_ROOM_HOWTO.md` was fully rewritten to reflect all vocabulary, button names, and flow changes introduced in P1–P3.

---

### P2 — Casting Room Overhaul (May 3 2026)

**Vocabulary cleanup (Epic hcm):**

All Approve/Reject language was replaced with clearer, context-specific labels:

| Location | Old label | New label |
|---|---|---|
| Audition view — accept | Approve | **Select this look** |
| Audition view — reject | Reject | **Pass** |
| Batch candidate — accept | Approve | **Cast this character** |
| Batch candidate — reject | Reject | **Dismiss** |
| Gallery — keep | Approve | **Keep** |
| Gallery — remove | Reject | **Discard** |
| Batch similarity labels | accepted / needsMutation / rejected | **unique / needs change / too similar** |
| Empty state (no briefs) | "No bank characters yet" | **"No casting briefs yet"** |

**UX improvements (Epic xpf):**
- **Prompt packs auto-load** when an Active Character is selected — no manual "Load" button needed.
- Button label switches to **Recompile Packs** when packs already exist.
- **Workflow selector** added to Cast from Bank step — choose which ComfyUI workflow to use before generating auditions.
- **Gallery subtitle** now shows: *Showing images for: [Character Name]*.
- **Polling resumes after page reload** — pending audition and portfolio ComfyUI jobs are saved to `sessionStorage` and automatically resumed when the panel re-mounts.

**Journey B — Batch generation form (Epic jg7):**
- A `+ Generate Batch` form was added above the batch selector.
- Fields: age range (e.g. 25–35), count, gender, project tone (e.g. cinematic, editorial, raw).
- Submits to `/api/characters-generate-batch` with `persistBatch: true`; the batch list refreshes automatically on success.

---

### P1 — Critical Bug Fixes (Apr 2026)

- **More Takes gate:** The More Takes panel now unlocks only when ComfyUI reaches a terminal state (completed/failed), not when the user manually approves a candidate.
- **Journey A ghost images:** Fixed double-render caused by audition jobs being queued twice (once on generate, once on auto-queue).
- **Journey A promotion:** Characters generated in Journey A are created in the database at generation time and appear in the Active Character dropdown after the user clicks **Select this look**.
- **Auto-poll + auto-ingest:** Audition and portfolio images now ingest automatically when ComfyUI finishes — no manual "Ingest" click required.
- **LM Studio timeout fixes:** JSON mode, `enable_thinking` suppression, and configurable `max_tokens` added to prevent silent failures with larger LM Studio models.
- **Casting Room layout restructure:** Panels reorganized into a clearer top-to-bottom flow matching the actual work sequence.
- **Actor Bank view added:** A dedicated tab for browsing all saved characters with filters.

---

## 2. Application Interface

The app has four main tabs accessible via the top navigation bar.

---

### Tab 1 — Prompt Builder

The main workspace. Everything here assembles into a single prompt string.

#### Left column — Controls

**Scene Input**
Free-text field. Describe the scene in plain English. The system rewrites it into cinematic material language using an internal REWRITES table (textures, surfaces, architectural details).

**Director Section**
Grid of 60 directors, each with a distinct aesthetic. Select one to define the visual register of the prompt. Each director provides 3–4 pre-written scenarios per character count.

> Example directors: Agnès Varda (French New Wave), Wong Kar-wai (saturated neon nostalgia), Satyajit Ray (realist humanism), Lucile Hadžihalilović (fairytale unease).

**Character Configuration**
- Number of characters (1, 2, or 3)
- Gender and age per character (child / teen / 20s / 30s / 40s / 50s / elderly)
- The selected director's scenarios update automatically to match.

**Scenario Selector**
Pick from the director's available scenarios for the chosen character count. Each scenario is a short narrative situation that frames the image.

**Chip Sections** (collapsible)
Six groups of technical modifiers:

| Group | Controls |
|---|---|
| Shot + Lens | Composition type, focal length, camera movement |
| Environment + Texture | Location architecture, surface materials |
| Composition | Frame placement, figure positioning, depth |
| Light | Single-source physical light description |
| Palette + Grade | Color temperature, saturation, split-toning |
| Film + Qualifiers | Film stock, grain, anti-CGI anchors |

Each chip is a short phrase that appends to the final prompt. Multiple chips can be active simultaneously.

**Time / Weather Quick-Set**
Buttons for rapid time-of-day and weather presets (golden hour, overcast, night, etc).

**Composition Modifiers**
Additional framing controls (rule of thirds, negative space, edge tension, etc).

**Garment / Clothing Expander**
Expands the scene description with clothing material and texture detail.

**Reference Image Upload**
Upload a reference image. The backend (via Claude Vision API) extracts dominant palette, mood, and composition notes, which are injected into the assembled prompt.

---

#### Right column — Prompt Output (sticky)

The assembled prompt lives here. This panel stays visible as you scroll.

**Prompt textarea**
Fully editable. The assembled prompt appears here; you can type over it or edit inline.

**Polish with AI**
Sends the assembled fragments to the configured LLM. The LLM returns a single coherent 60–110 word prompt. Rules enforced:
- Physical descriptions only (no abstract adjectives like "moody")
- Static composition — no motion or action
- Figures are passive: absorbed, waiting, unaware
- One light source maximum
- Environment larger than figures
- Film stock and grain integrated naturally
- Anti-CGI language embedded (photorealistic, analog, shot on film, not CGI)

**Engine selector**
Choose which AI provider handles polishing:
- **Auto** — tries embedded sidecar → local LLM → Claude cloud
- **Local (Ollama)** — your Ollama instance
- **Local (LM Studio)** — LM Studio HTTP API
- **Cloud (Claude)** — Anthropic API
- **Local Only toggle** — disables cloud fallback; fails immediately if local unavailable

**Variants**
Generate alternate phrasings of the current polished prompt. Useful for A/B testing.

**Restored text**
Revert to the previous state of the prompt before your last edit.

**Apply diff view**
Visual comparison of your manual edits versus the polished base.

**Quality score**
A numeric score and hints based on prompt rule compliance.

**Export**
- Copy to clipboard
- Download as `.txt` file (includes negative prompt)

**Saved prompts panel**
Save and name snapshots of the current prompt. Persisted to `localStorage`.

**Generated image gallery**
When ComfyUI produces images from your prompt, they appear here inline.

---

### Tab 2 — Character Builder

Create and manage casting briefs — reusable character descriptions that feed into the Casting Room.

**Create a casting brief**
- Enter a name and a description (physical features, personality notes, references).
- The description is saved as a `@snake_case` slug (e.g. `@elena_portrait`).
- Stored in both the SQLite database and `localStorage`.

**AI optimization**
Send the description to LM Studio for refinement — the LLM rewrites it into tighter, more visually specific language suitable for image generation prompting.

---

### Tab 3 — Casting Room

The full character production pipeline. Two journeys live here side by side.

> See also: `docs/CASTING_ROOM_HOWTO.md` for a step-by-step reference.

**Journey A — Cast from Bank** (left column)

Produces audition images for a specific casting brief using ComfyUI.

Steps:
1. Select a casting brief from the dropdown
2. Select a ComfyUI workflow
3. Click **Generate Auditions** — LM Studio generates N character profiles
4. Two ComfyUI jobs queue per candidate: front-facing and profile portrait
5. Panel polls ComfyUI automatically; images ingest when ready
6. Review each candidate: **Select this look** or **Pass**
7. Optionally click **More Takes** to generate additional views of a selected candidate

**Journey B — Batch Pipeline** (right column)

Produces a batch of diverse characters without a pre-existing casting brief.

Steps:
1. Click `+ Generate Batch` and fill in: age range, count, gender, project tone
2. The system generates candidates and runs a similarity check
3. Each candidate is labeled: **unique / needs change / too similar**
4. Review candidates: click **Cast this character** to approve or **Dismiss** to remove
5. Approved candidates are saved as characters in the database

**Active Character** (shared section)

Once a character is cast (from either journey), they appear as the Active Character.

- **Prompt packs auto-compile** when an Active Character is first selected
- Click **Recompile Packs** to regenerate if the character description was edited
- **Rename**: click the character name inline to rename; press Enter to save
- **Archive**: hides the character from the dropdown; recoverable via the Archived panel

**Portfolio**

Queue a set of views for the Active Character. Available view types:
- Front portrait
- 3/4 portrait
- Profile portrait
- Full body
- Audition (dramatic)
- Cinematic scene

Click **Queue Portfolio** to send all selected views to ComfyUI as separate jobs. Images ingest automatically as jobs complete.

**Gallery**

All generated images for the Active Character appear here.
- **Keep** — marks image as approved
- **Discard** — marks image as rejected
- Subtitle: *Showing images for: [Character Name]*

---

### Tab 4 — Actor Bank

Browse all saved characters with filtering and search.

- Filter by status, gender, age range, project tone
- View character cards with key metadata
- Click a character to load them as the Active Character in the Casting Room

---

## 3. Full Workflow Walkthrough

### Core Prompt Loop

```
Scene Input
    ↓
Director Selection  +  Scenario
    ↓
Character Config (count / gender / age)
    ↓
Chip Selection (shot, lens, light, etc.)
    ↓
assemblePrompt() → ordered fragment array
    ↓
Polish with AI (optional)
    ↓
LLM → 60–110 word coherent prompt
    ↓
Edit / variants / quality check
    ↓
Copy / export / send to ComfyUI
```

---

### Journey A — Cast from Bank

```
Character Builder tab
  └── Create casting brief (@name + description)

Casting Room — Cast from Bank
  └── Select casting brief
  └── Select ComfyUI workflow
  └── Generate Auditions
        └── LM Studio: generate N character profiles
        └── ComfyUI: queue front + profile portrait per candidate
        └── Auto-poll → auto-ingest on completion
  └── Review candidates
        ├── Select this look  →  character saved to DB, appears in Active Character ↓
        │                        confirmation message shown, page scrolls to Active Character
        └── Pass             →  candidate skipped
  └── (optional) More Takes
        └── Queue additional views for the selected candidate
        └── Auto-ingest

Active Character section  (Journey A arrives with audition images already in Gallery)
  └── Prompt packs auto-load
  └── Queue Portfolio
        └── Select views (front, 3/4, profile, full body, audition, scene)
        └── ComfyUI jobs queued → auto-ingested

Gallery
  └── Keep / Discard per image
```

---

### Journey B — Batch Pipeline

```
Casting Room — Batch Pipeline
  └── + Generate Batch form
        ├── Age range (e.g. 25–35)
        ├── Count (e.g. 8)
        ├── Gender
        └── Project tone (e.g. cinematic, editorial, raw)
  └── LM Studio generates candidates
  └── Similarity check runs automatically
  └── Review candidates
        ├── unique        →  safe to use
        ├── needs change  →  review before casting
        └── too similar   →  likely duplicate
  └── Cast this character  →  saved to database
  └── Dismiss             →  hidden from batch (recoverable via "Show dismissed" toggle)
                              click Reconsider to return candidate to pending review

Active Character section  (Journey B arrives with no images — Queue Portfolio to generate first set)
  └── Prompt packs auto-load
```

---

## 4. External Services

The following services must be running locally for full functionality. Each has a specific role. Cloud-only mode (Vercel) only requires the Anthropic API key.

---

### LM Studio

**Role:** Primary local LLM provider + embedding provider  
**Used for:**
- Generating character profiles in Journey A auditions
- Optimizing casting brief descriptions (Character Builder tab)
- Polishing prompts in **Local (LM Studio)** engine mode
- Batch character generation in Journey B
- Generating text embeddings for Chroma similarity search (replaces Ollama)

**Default URL:** `http://localhost:1234/v1` (or your network IP, e.g. `http://192.168.1.135:1234/v1`)

---

#### What to load in LM Studio

LM Studio needs **two models loaded simultaneously** — one for text generation and one for embeddings. Both run from the same LM Studio server.

**Model 1 — Instruction / Chat model (for character generation + prompt polish)**

This is the model that thinks and writes. Recommended:

| Model | Size | Notes |
|---|---|---|
| `Qwen2.5-7B-Instruct` | ~5 GB | Best balance of quality and speed |
| `Qwen2.5-14B-Instruct` | ~9 GB | Higher quality, needs more VRAM |
| `Qwen3-8B` | ~5 GB | Good alternative |

How to load it:
1. Open LM Studio → **Discover** tab
2. Search for `Qwen2.5-7B-Instruct` (or your preferred model)
3. Download it
4. Go to **My Models** → click the model → **Load**

The model name shown in LM Studio after loading is what you put in `LMSTUDIO_MODEL` in `.env.local`.

---

**Model 2 — Embedding model (for similarity search)**

This is a small, fast model that converts text into vectors. It does not generate text — it only produces numbers used for similarity comparison. Recommended:

| Model | Size | Notes |
|---|---|---|
| `nomic-embed-text-v1.5` | ~270 MB | Best choice — widely supported |
| `text-embedding-nomic-embed-text-v1.5` | ~270 MB | Same model, alternate name in some LM Studio versions |

How to load it:
1. Open LM Studio → **Discover** tab
2. Search for `nomic-embed-text`
3. Download `nomic-embed-text-v1.5` (from nomic-ai)
4. Go to **My Models** → click the embedding model → **Load**

> **Important:** LM Studio can run both models at the same time. After loading each one, both should appear as "Loaded" in the model list. The server serves both from the same port (`1234`).

The embedding model name shown in LM Studio after loading is what you put in `LMSTUDIO_EMBED_MODEL` in `.env.local`.

---

**How to start the server:**
1. Go to the **Local Server** tab in LM Studio
2. Both loaded models will be available automatically — no extra steps
3. Click **Start Server**
4. Confirm it shows `Server running on port 1234`

**Required for:** Journey A auditions, Journey B batch generation, character description optimization, similarity search

**Environment variables:**
```
LLM_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=Qwen2.5-7B-Instruct      ← exact name from LM Studio
LMSTUDIO_EMBED_MODEL=nomic-embed-text-v1.5  ← exact name from LM Studio
LMSTUDIO_TIMEOUT_MS=45000
```

---

### ComfyUI

**Role:** Image generation backend  
**Used for:**
- Rendering audition portraits (front + profile per candidate)
- Rendering portfolio views (front, 3/4, profile, full body, audition, cinematic scene)
- All image output in the Casting Room

**Default URL:** `http://127.0.0.1:8188`

**How to start:**
1. Navigate to your ComfyUI directory
2. Run: `python main.py` (or `python main.py --listen` if the app runs on a different machine)
3. Confirm the web UI is accessible at `http://127.0.0.1:8188`

**Workflows:** The app reads workflow files from `api/lib/comfy/workflows/`. Each workflow needs a `.json` file (the ComfyUI workflow export) and a `.mapping.json` file (maps logical fields like `positive_prompt` to node IDs).

**Required for:** All image generation. Without ComfyUI, auditions and portfolio generation will queue but never complete.

**Environment variable:**
```
COMFYUI_BASE_URL=http://127.0.0.1:8188
ENABLE_COMFY_API=true
```

---

### Ollama *(optional — not needed if LM Studio is running)*

**Role:** Alternative LLM provider + embedding fallback  
**Used for:**
- Prompt polishing in **Local (Ollama)** engine mode
- Generating text embeddings when `LLM_PROVIDER=ollama`

When `LLM_PROVIDER=lmstudio`, the app uses LM Studio for embeddings instead and Ollama is not required.

**Default URL:** `http://127.0.0.1:11434`

**How to start (if needed):**
```bash
ollama serve
ollama pull nomic-embed-text
```

**Environment variables (only needed if using Ollama):**
```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

### Chroma (Vector Database)

**Role:** Semantic similarity search  
**Used for:**
- Checking whether new batch candidates are too similar to existing characters
- Similarity search in the Actor Bank

**Default URL:** `http://127.0.0.1:8000`

**How to start:**
```bash
pip install chromadb
chroma run --path ./chroma-data
```

**Required for:** The similarity labels (unique / needs change / too similar) in Journey B. Without Chroma, similarity checking will fail or be skipped.

**Environment variable:**
```
CHROMA_URL=http://127.0.0.1:8000
ENABLE_VECTOR_MAINTENANCE_API=true
```

---

### Anthropic Claude API (Cloud)

**Role:** Cloud LLM fallback + reference image analysis  
**Used for:**
- Polishing prompts when engine is set to **Cloud** or **Auto** with no local LLM available
- Analyzing reference images (extracts palette, mood, composition notes)

**Not a local service** — just an API key. No server to start.

**Environment variable:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### SQLite (Local Database)

**Role:** Persistent data store  
**Not an external service** — it is a file on disk. No server required.

**Stores:** Characters, casting briefs, audition candidates, batches, prompt packs, generated image records, ComfyUI job tracking.

**Default path:**
```
SQLITE_DB_PATH=./data/qpb-local.sqlite
```

The file is created automatically on first run. Back it up periodically — it contains all your character work.

---

## 5. Environment Variables

Full `.env.local` reference for local studio mode:

```bash
# Mode
APP_MODE=local-studio

# LLM Provider
LLM_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://192.168.1.135:1234/v1
LMSTUDIO_MODEL=Qwen2.5-7B-Instruct
LMSTUDIO_TIMEOUT_MS=45000

# Fallback cloud LLM
ANTHROPIC_API_KEY=sk-ant-...

# Image generation
COMFYUI_BASE_URL=http://127.0.0.1:8188

# Embeddings (LM Studio handles this — no Ollama needed)
LMSTUDIO_EMBED_MODEL=nomic-embed-text-v1.5
CHROMA_URL=http://127.0.0.1:8000

# Database
SQLITE_DB_PATH=./data/qpb-local.sqlite

# Feature flags
ENABLE_CHARACTER_BATCH_API=true     # batch generation, candidate review, Journey B pipeline
ENABLE_PROMPT_PACK_API=true         # prompt pack compilation and listing
ENABLE_COMFY_API=true               # ComfyUI job queuing, polling, and ingestion
ENABLE_GENERATED_IMAGES_API=true    # gallery: list, approve/keep, reject/discard, view images
ENABLE_VECTOR_MAINTENANCE_API=true  # similarity search and character vector index
```

---

### Quick Service Checklist

Before starting a local session, confirm these are running:

| Service | Command | URL | Required for |
|---|---|---|---|
| **LM Studio** | Start server in app | `localhost:1234` | Character generation, prompt polish, embeddings |
| **ComfyUI** | `python main.py` | `localhost:8188` | All image generation |
| **Chroma** | `chroma run --path ./chroma-data` | `localhost:8000` | Similarity search (Journey B only) |
| **App (dev)** | `npm run dev` | `localhost:5173` | Frontend + API |
| **Ollama** | `ollama serve` | `localhost:11434` | Only needed if `LLM_PROVIDER=ollama` |
