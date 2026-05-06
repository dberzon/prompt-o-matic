# PROJECT CONTEXT — Prompt-o-matic

## Overview

Prompt-o-matic (Qwen Prompt Builder) is a cinematic prompt authoring system designed to generate structured, high-quality prompts for Qwen Image 2512.

It transforms natural language into film-style prompt language using:
- director-specific framing
- technical parameters (lighting, lenses, film stock)
- LLM-based prompt polishing

---

## Architecture

Three-layer system:

1. Frontend: React (Vite)
2. API Layer: Node.js
3. Domain Logic Core

---

## Core Flow (Generate → Polish → Display)

1. User configures:
   - scene
   - scenario
   - chips
   - characters
   - director

2. Prompt is assembled in:
   - `src/utils/assembler.js`

3. Assembly triggered in:
   - `App.jsx` (useMemo)

4. User clicks "Polish with AI":
   - `PromptOutput.jsx`

5. Frontend sends request via:
   - `usePolish.js`

6. API endpoint:
   - `POST /api/polish`

7. Backend processing:
   - `api/polish.js`
   - delegates to `runPolish()`

8. Core logic:
   - `api/lib/polish/polishCore.js`

   Responsibilities:
   - build LLM prompt
   - resolve provider
   - call provider
   - normalize output

9. Provider layer:
   - Ollama (local)
   - LM Studio
   - embedded provider
   - Claude (cloud fallback)

10. Response returns to frontend

11. UI displays result:
   - `PromptOutput.jsx`
   - priority:
     - restored
     - variant
     - polished
     - assembled fallback

---

## Key Files

### Frontend orchestration
- `src/App.jsx`

### Prompt assembly
- `src/utils/assembler.js`

### Output UI
- `src/components/PromptOutput.jsx`

### API communication
- `src/hooks/usePolish.js`

### Backend entry
- `api/polish.js`

### Core logic
- `api/lib/polish/polishCore.js`

### Providers
- `api/lib/llm/providers/*`

### Variants
- `src/utils/variants.js`

### Quality scoring
- `src/utils/qualityScore.js`

---

## Runtime Modes

Controlled by `APP_MODE`

### Web (Cloud Mode)
- static frontend
- limited features
- no local processing

### Tauri (Local Studio)
- full system enabled
- local LLM
- vector search
- batch generation
- ComfyUI integration

---

## Core Subsystems

### Prompt Assembly
- builds structured prompt fragments
- orders by cinematic priority
- deduplicates

### Polish System
- LLM-based refinement
- adds cinematic language
- uses system prompt rules

### Provider Resolution
- selects best available LLM:
  - embedded
  - local (Ollama / LM Studio)
  - cloud fallback

### Image Pipeline
- handled via ComfyUI
- triggered externally

---

## Key Risks / Complexity Areas

- provider selection logic
- async API flow
- LLM non-determinism
- dual runtime modes
- external dependencies (ComfyUI, local LLMs)

---

## Safe Modification Zones

- UI display logic
- prompt assembly tweaks
- fragment ordering
- minor API payload changes

---

## Dangerous Zones

- `polishCore.js`
- provider resolution
- async API handling
- embedded / local provider logic

---

## Entry Points

- `index.html`
- `src/main.jsx`
- `src/App.jsx`

---

## Purpose

Bridge:
Natural language → cinematic prompt engineering

---

## Notes

System is designed for:
- creative professionals
- consistent visual generation
- reusable prompt workflows