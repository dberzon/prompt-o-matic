# Comprehensive Gap Analysis — Qwen Prompt Builder → Universal AI Character & World Bible Generator

**Date:** May 2026
**Reviewer scope:** Source-of-truth analysis of the May 2026 working tree at `c:\Users\user\Documents\qwen-prompt-builder` against the stated target vision: *a universal AI Character & World Bible generator for scriptwriters and AI filmmakers* with rich extrapolation from minimal seeds, proactive gap detection + conversational clarification, strong consistency for long-form film/series, high-quality structured outputs (JSON + Markdown), and extensible architecture (MCP / tool calling).

**Method:** Code wins over docs. Cross-referenced against the existing internal review at `comprehensive_review.md` and verified against current source (`api/lib/extrapolation/`, `api/lib/continuity/`, `api/lib/llm/providers/`, `api/lib/db/schema.js`, `src/components/EntityEditor.jsx`, `api/lib/polishCore.js`, `vite.config.js`, `package.json`).

---

## 1. One-paragraph verdict

QPB has done the **infrastructure work** for a Bible generator — provenance-tracked entity attributes, **type-aware** extrapolation with disk cache (`stageRegistry.js`: character-shaped S1–S6, `location` three-stage pipeline, `era` placeholder chain), a 5-scene blind continuity QA gate, lifecycle state machines, Zod boundary validation on legacy characters, and a craft-grade 88-line polish system prompt. What is **missing is the product layer**: there is no formal Bible schema, no structured "Bible completeness" model (Location/Era are not yet *rich product objects* despite `location` / `era` entity types), no Family bible type, no gap-detection or clarification loop, no Markdown/JSON Bible export, no project root tying scenes/characters/locations together, no prompt registry, no MCP/tool-calling surface despite the dependency being installed, and the editor UI is a flat attribute list dressed with section tabs whose contents are decided by a string-prefix hack. The codebase is **ready** for the product layer — the columns and the abstractions are sitting empty — but as it stands today it is still weighted toward **one character-shaped extrapolation story** plus an early **location** track, not a universal world-bible builder.

---

## 2. Gap Analysis Table

| # | Feature / Requirement | Current Status | Gap Size | Priority | Recommended Solution | Estimated Effort |
|---|---|---|---|---|---|---|
| **A. Input parsing & seed description handling** ||||||
| A1 | Per-Bible-type structured seed forms (Character / Family / Location / Era / VisualRef) | Only one form exists: `CharacterBuilder.jsx` free-text. Continuity `entities` accept `type` ∈ `character\|environment\|prop\|institution\|location\|era` (see schema), but there is no per-type seed wizard; `location` / `era` rely on the same freeform attribute model as other entities. No `family` type. | **Major** | **Critical** | Add per-type seed wizards (`SeedWizard.jsx`) gated by entity `type`. Each wizard collects 3–8 directed fields ("if Character: name, age, era, role, 1-line look; if Location: name, era, country/region, function, weather/season"). Persist as canon attributes via existing `writeAttribute()`. | 1 wk |
| A2 | Multi-entity seed ingest (cast + world in one paste) | Absent. Seeds are one-entity-at-a-time. | Major | High | New `POST /api/seed/parse` endpoint backed by a dedicated S0 LLM pass that splits a long synopsis into proto-entities (`{type, name, seedNotes}[]`) the user confirms before commit. | 1 wk |
| A3 | Free-text → canon attribute extraction (S1) | Implemented as `s1EntityExtraction.js` + the one Zod schema in the pipeline (`schemas/s1EntityExtraction.js`). Quality is good for characters; weak for non-character types (S1 prompt explicitly: "Environments and props get minimal canon attributes (usually name only)"). | Minor (chars) / Major (non-chars) | High | Type-aware S1 prompt variants: `s1Character.prompt`, `s1Location.prompt`, `s1Era.prompt`, `s1Family.prompt`. Dispatch on `entity.type` inside the orchestrator. | 4 days |
| A4 | Reference image as a seed input (VisualRef Bible) | `visual_anchors` table + `VisualAnchorPicker.jsx` upload exist. Bytes are injected into ComfyUI mapping. No CLIP / face-embedding extraction from the reference, no LLM vision pass on it. | Major | High | Add an optional vision-LLM step (Claude vision or LM Studio multimodal) that produces canon attributes (`face.*`, `wardrobe.*`, `palette.*`) from the uploaded reference. Also persist a CLIP embedding for later drift checks (see E5). | 1.5 wk |
| **B. Bible generation quality and depth** ||||||
| B1 | Formal "Bible" schema (sections, required fields, completeness measure) | **None.** A Bible is "whatever attributes the LLM tossed over the wall." `EntityEditor.jsx:10-15` hardcodes section *names* per type, but section content is `<CanonAttributesPanel sectionPrefix={section.toLowerCase()} />` — i.e. attributes whose key happens to start with that lowercase prefix. | **Major** | **Critical** | New `api/lib/bibles/` with per-type Zod schemas: `characterBible.schema.js`, `locationBible.schema.js`, `eraBible.schema.js`, `familyBible.schema.js`, `propBible.schema.js`. Each declares required and recommended sections + fields. Drives B2, C1, C2, D1, I1. **Single highest-leverage change in the system.** | 2 wk |
| B2 | Extrapolation pipeline depth | Strong for **characters** (S1–S6) with disk cache and parallel middle stages. **`location`** has a dedicated three-stage chain (geography / inhabitants / history). Other character-shaped types (`environment`, `prop`, `institution`) still reuse the character pipeline — S3 portrait-behavior prefixes and S5 portrait framing can misfit. **`era`** is stubbed. S4 remains oriented from character-shaped runs. | Major | High | Extend type-specific stages (beyond shipped `location`) and tune S1/S3/S5 for non-human entity kinds. | 2 wk |
| B3 | Era Bible as a first-class type | **Partial.** `entities.type` includes `'era'` and `stageRegistry` returns a placeholder chain (no-op stages) until an era pipeline ships. Narrative era context still often lives in string canon attrs (`setting.era`) on other entities. | Major | High | Implement real era stages + prompts; bind characters/locations via `entity_relationships` (e.g. `type='set_in_era'`). | 1 wk |
| B4 | Family / Relationship Bible | Partial. `entity_relationships` exists; S4 emits `provenance=derived` relationship attrs keyed by `relation.<type>:<other_slug>`. No "Family" entity that groups members + lineage + traditions. | Medium | Medium | Either: (a) add `'family'` entity type with members as relationships, or (b) introduce a `entity_groups` lightweight table. Recommended (a) — fits existing schema. | 5 days |
| B5 | Per-entity completeness ring / "missing" highlight | **None.** `EntityEditor.jsx` shows attributes flat, no progress meter, no required-field highlighting, no "X of Y required fields present" indicator. | Major | High | Derives directly from B1: `getBibleCompleteness(entityId)` → `{ratio, missingRequired[], missingRecommended[]}`. Render as a ring + per-section badge in `EntityEditor`. | 3 days (after B1) |
| **C. Gap detection & questioning system** ||||||
| C1 | Proactive omission detection ("what's missing?") | **Essentially absent.** Closest thing is `MVP_DONE_GATE_MIN_CANON_ATTRIBUTES = 12` — a count, not a gap report. S6 (`s6ConflictDetection.js`) detects **contradictions**, not **omissions**. | **Major** | **Critical** | After B1: a deterministic "GapInspector" that diffs current attributes against the Bible schema and emits prioritized prompts ("No wardrobe lower garment defined", "Soviet 1989 setting has no period-appropriate slang"). No LLM needed for the inspector itself. | 4 days (after B1) |
| C2 | Conversational clarification UI ("ask me about X before I infer it") | **Absent.** No chat surface anywhere. Polish, extrapolation, and character optimization all run open-loop. | Major | High | New `ClarifyPanel.jsx` + `POST /api/clarify/:entityId` endpoint. Given GapInspector output, generate 1–5 short questions ("Is Ruslan an only child, or does he have a sibling?") with multiple-choice + free-text answers. Each answer becomes a canon attribute write. | 1.5 wk |
| C3 | Per-stage suggested clarifications (mid-pipeline pauses) | Absent. Pipeline runs all 6 stages then surfaces results. | Medium | Medium | The orchestrator already has `onStageComplete` (`orchestrator.js:69`). After S1, run GapInspector once before S2–S5 start. If gaps exist, pause and surface ClarifyPanel; user can accept-and-continue or fill gaps first. | 4 days (after C2) |
| C4 | Stage 6 conflict review | **Implemented**, `EntityConflictPanel.jsx` + `conflictResolution.js`. Good. | None | — | Keep. | — |
| **D. Structured output & versioning** ||||||
| D1 | Zod schemas for every stage output (S1–S6) | Only S1 (`schemas/s1EntityExtraction.js`). S2–S6 use `parseJsonFromLlmText()` + `if (!item?.key) continue` (silent drop, e.g. `s2Parser.js:9`). | Major | Critical | Per-stage Zod output schemas. Use LM Studio `response_format.json_schema` and Claude tool-use mode (see H1) to force schema-conformant output at the provider boundary. | 1 wk |
| D2 | Retry / repair loop on parse failure | **None.** If a stage returns malformed JSON the orchestrator records empty writes and moves on. | Major | High | Add `parseOrRepair(rawText, schema, llm)` helper — on Zod failure, second pass to the LLM with `"Fix this JSON to match the schema: {error} — original: {raw}"`. Max 1 retry. | 3 days |
| D3 | Bible export to Markdown | **Absent.** No code path emits a `.md` Bible. | Major | High | `GET /api/entities/:id/bible.md` and `bible.json` endpoints. Markdown renderer in `api/lib/bibles/render.js` produces section-by-section output keyed off the Bible schema. Add "Export" button in `EntityEditor`. | 4 days (after B1) |
| D4 | Bible versioning / snapshots / branching | Attribute-level `supersedes` chains exist (`promoteToCanon`, `supersedeAttributeBy` in `repositories.js`). **No Bible-level snapshot, no "Draft vs Approved", no what-if branches.** | Medium | Medium | New `entity_snapshots` table storing a frozen attribute hash + label + timestamp. Restore = bulk re-write attributes from snapshot. Branching deferred to P2 — solo creators rarely need it. | 1 wk |
| D5 | Diff view between Bible versions | Absent. | Medium | Low | After D4: simple attribute-key diff renderer in `EntityHistoryPanel`. Reuses existing `AttributeHistoryPanel.jsx`. | 3 days |
| **E. Visual prompt engineering & consistency layer** ||||||
| E1 | Cinematic polish prompt + director registry | **Strong.** `polishCore.js` SYSTEM_PROMPT is 88 lines of real craft (named film stocks, anti-CGI anchors, one-light-source rule). 61 directors in `src/data/directors.js`. Assembler enforces cinematic order + Jaccard dedupe. | None (craft) / Minor (extensibility) | Low (keep), Medium (extensibility) | Don't touch the prompt without reason. Extensibility: move the polish prompt into the prompt registry (G1) so per-project / per-genre overrides become possible. | 2 days (after G1) |
| E2 | Per-character reference-image conditioning | Implemented — `buildComfyPromptPayload` injects primary `visual_anchors.reference_image` bytes when the ComfyUI mapping allows. | Minor | Medium | Keep. Add an explicit "primary anchor confirmed" badge in the editor (today it's only inferable from "isPrimary"). | 1 day |
| E3 | IPAdapter / identity locking on Qwen-Image | Spec-only. `api/lib/comfy/ipadapterFeasibility.js` and its test confirm Qwen-Image DiT has no validated IPAdapter chain. `ipadapterEmbeddingCache.js` exists but has nowhere to plug in. | Major | Medium | Monitor upstream ComfyUI nodes; meanwhile route consistency budget into LoRA (E4) and drift checks (E5). | (external) |
| E4 | Per-character LoRA training | Explicitly deferred (P2). Recommendation comment in `continuityQaScoring.js:9` mentions escalation but no code path. | Major | Medium | Add an out-of-process trainer (`scripts/train-character-lora.mjs`) using kohya_ss or similar; trigger when continuity QA < 4. LoRA path stored on `characters.lora_path` (new column). | 3 wk |
| E5 | Cross-shot face-similarity drift tracking | **Absent.** Once a generation lands there's no automated face-similarity check against the primary anchor. No image-embedding pipeline (text embeddings only via Ollama/LM Studio). | Major | High | Add a tiny ArcFace / InsightFace step in `comfyService.ingestImage()` that scores cosine similarity vs primary anchor, persists to `generated_images.similarity_to_anchor`. Surface as a per-image badge; auto-reject below threshold. | 1.5 wk |
| E6 | Universal continuity QA (not hardcoded fixture) | Hardcoded to a Ruslan-Perestroika 5-scene fixture (`continuityQaHarness.js:3-39`). | Major | High | Generate the 5 scenes from the entity's own bound era/locations (4-time-of-day spread + 1 wide). Replace hardcoded `CONTINUITY_QA_SCENES` with a generator. | 1 wk |
| **F. Project memory & long-term consistency** ||||||
| F1 | `projects` (production) root entity | **Schema columns exist, unused.** `characters`, `prompt_packs`, `generated_images` all have `project_id TEXT — Reserved for Production Room feature (Horizon 2). Not currently used.` (`schema.js:4, 17, 30`). No `projects` table. | Major | **Critical** | Add `projects` table (id, name, archetype, era_id, created_at). Add `project_id` to `entities`. Project selector in header. Filter every list endpoint by active project. **Tiny implementation, unlocks everything downstream.** | 4 days |
| F2 | Scene / Episode graph | Absent. `generated_images` is keyed by `characterId` and `promptPackId` — flat, only `created_at` ordering. | Major | High | New `scenes` table (id, project_id, episode, scene_no, narrative_beat, location_id, time_of_day, wardrobe_state). Reference from `generated_images.scene_id`. | 1.5 wk |
| F3 | Wardrobe / state evolution across the timeline | Absent. No way to encode "in Act 2 Ruslan loses his jacket" so subsequent renders inherit. | Major | Medium | `entity_state_changes` table (entity_id, scene_id, key, old_value, new_value). State-aware prompt compile reads the most recent state ≤ current scene. | 1.5 wk (after F2) |
| F4 | Cross-document context retrieval | Chroma is plumbed and auto-started but **only used for character-level dedup at 0.18/0.28 thresholds** (`batchGeneration.js`). Not used for lore/scene/reference retrieval. | Medium | Medium | Index `entity_attributes` and `scenes.narrative_beat` into Chroma collections. Inject top-K matches into S2 / S4 prompts as grounding context. | 1 wk |
| F5 | Cache key allows manual reroll | `stageCache.js` keys on `(canon_snapshot, stageId, modelId)` — correct for unchanged canon, but no way to reroll without disk delete. | Minor | Low | Add a per-stage `?rerollSalt=<uuid>` query param that mixes into the cache key. UI: "Regenerate stage" button. | 1 day |
| **G. Prompt management & system prompts** ||||||
| G1 | Inline-string prompts everywhere | **All prompts are inline JS strings**: `polishCore.js:12-99`, `characterOptimizeCore.js:3-17`, every `extrapolation/prompts/sN*.js` (a `.join('\n')` of literal lines), `auditionPrompts.js`, `promptDescriptor.js`, `qwenPromptCompiler.js:viewRules`. | Major | High | Prompt registry: `api/lib/prompts/library/<slug>.prompt.md` with YAML frontmatter (id, version, inputSchema, outputSchema, description). `getPrompt(id, version?)` resolver. Migrate the ~10 existing prompts. | 1 wk |
| G2 | Prompt versioning / rollback / A-B test | **None** beyond git history. | Medium | Medium | Falls out of G1 — frontmatter `version` + a tiny telemetry table (`prompt_runs` with `prompt_id`, `version`, `success`, `duration_ms`) enables A/B. | 4 days (after G1) |
| G3 | Per-project / per-genre prompt overrides | Absent. The 88-line polish prompt is bound to one aesthetic register. | Medium | Medium | After F1 + G1: a `project_prompts` table mapping `(project_id, prompt_id) → version_override`. Project selector resolves the override at request time. | 3 days (after F1 + G1) |
| G4 | Prompt observability (see actual prompt that ran) | None for extrapolation. `usePolish.js` has dev capture only. | Medium | High | Persist `(prompt_id, version, rendered_prompt, response, latency, model)` to a `prompt_runs` table. Devtools panel reads it. | 4 days |
| G5 | Surface dropped items from parsers | Parsers silently drop malformed JSON items (`s2Parser.js:9` `continue`). | Medium | High | Each parser returns `{writes, dropped: [...]}`. Orchestrator includes `dropped` in stage result; UI shows `"3 attributes returned, 1 dropped (missing key)"`. Tiny, hugely valuable. | 1 day |
| **H. Tool calling / MCP readiness** ||||||
| H1 | Tool calling / function calling at the provider boundary | **Effectively zero.** `claudeProvider.js` uses plain `messages` (no `tools`). `lmStudioProvider.js` supports `response_format` but not `tools`. `ollamaProvider.js` plain prompt. Every stage call asks the LLM nicely for JSON and hopes. | **Major** | **Critical** | Extend provider signatures with `tools` and `tool_choice`. Migrate S1–S6 to tool-calling instead of `responseFormat: 'json'` — this fixes D1 + D2 in one move. | 1 wk |
| H2 | MCP server (expose QPB capabilities to external LLMs) | **None**, despite `agentic-flow ^2.0.11` being a declared dependency in `package.json` and `.cursor/mcp.json` showing MCP servers are *consumed* (Serena, SQLite, Git, Figma, ComfyUI). QPB itself does not *publish* an MCP server. | Major | High | Add `mcp/qpb-server.mjs` exposing tools: `seedEntity`, `runExtrapolation`, `getBible`, `getGaps`, `answerClarification`, `renderScene`. Each tool wraps an existing `/api/*` endpoint. Distributable as a standalone Node binary. | 2 wk |
| H3 | Agent / multi-step planner | Absent. The dependency `agentic-flow` is installed but unused in source (no imports). | Medium | Low | Defer until H1 + H2 ship. Then a thin agent loop ("seed → gaps → ask user → re-extrapolate → render → score → loop") becomes natural. | 1 wk (after H1+H2) |
| H4 | OpenAPI / typed client for `/api/*` | Frontend uses hand-rolled `src/lib/api/*.js` over `apiGet`/`apiPost` in `http.js`. No OpenAPI spec, no generated client. | Medium | Low | Generate `openapi.json` from JSDoc tags on route handlers. Frontend client autogen from it. Quality-of-life, not vision-critical. | 1 wk |
| **I. Error handling & user experience** ||||||
| I1 | Bible editor surface (Entity Editor) | Weakest UI in the system. `EntityEditor.jsx`: 110 lines, section system is a string-prefix hack (`sectionPrefix={section.toLowerCase()}`), no completeness ring, no required-field highlight, no missing-field badges, no progress meter, no inline edit UX, no Bible export button. | **Major** | **Critical** | Schema-driven Bible editor: per-section forms generated from B1 schemas, completeness ring, required-field badges, inline edit with provenance-aware promote/edit, sticky export bar. | 2 wk (after B1) |
| I2 | Global error / toast system | None. Each component renders its own inline error string. ErrorBoundary catches React crashes only (`main.jsx`). | Medium | Medium | Add a tiny toast context (`useToast()`); replace ad-hoc `setError(err.message)` across components incrementally. | 4 days |
| I3 | Progress streaming for long extrapolation runs | SSE exists only for ComfyUI renders (`/api/render-events`). Extrapolation stages can run 2–4 min total with no streaming — only `onStageComplete` callback exists in the orchestrator, but the route handler returns when all stages finish. | Major | High | New SSE endpoint `/api/entities/:id/extrapolate/events`. Stream `stage-start`, `stage-complete`, `stage-error`, `parse-dropped` events. Wire `EntityExtrapolationPanel` to a per-stage progress strip. | 1 wk |
| I4 | Request timeouts / budgets | No per-request hard timeout, no budget per Bible. LLM stages can hang indefinitely. | Medium | Medium | Wrap `llmGenerate` in `Promise.race` with configurable `LLM_STAGE_TIMEOUT_MS`. Default 180 s. | 2 days |
| I5 | Inline prompt validation / rule feedback | `validatePromptRules`, `applyRuleFix` already exist in `src/utils/promptRules.js` for the cinematic prompt builder. Not extended to Bible editing. | Minor | Low | After B1: a `validateBible(entityId, schema)` mirror; surface as nudges in `EntityEditor`. | 3 days (after B1) |
| I6 | `vite.config.js` is a 2,278-line god-file with ~50 inline middleware blocks | Real risk: a single typo breaks every route, cold parse on every dev restart, inline handlers are hard to unit-test. | Medium | Medium | Mechanical refactor: extract each remaining inline middleware to `api/<route>.js` (mirror the pattern already established for `entities`, `entity-anchors`, etc.). | 1.5 wk |
| I7 | `App.jsx` is 970+ lines, ~30 `useState` | Maintenance hazard; mixed responsibilities (share-link, profile load, embedded poll, hash restore, tab routing). | Medium | Low | Extract `WorkspaceContext`, `ShareLinkProvider`, `EmbeddedHealthProvider`. Tab routing stays. Iterative refactor — don't block features. | 1 wk |
| I8 | `createVectorRuntime` opens fresh SQLite handle per request | Wasteful on every middleware. WAL setup + migrations idempotent but unnecessary. | Minor | Low | Single long-lived `db` connection + per-request transactions. | 3 days |
| I9 | Localstorage / SQLite race in Character Builder | `CharacterBuilder.jsx` loads bank entries on mount and overwrites localStorage — if user is editing while it resolves, edits are lost. | Minor | Medium | Don't overwrite localStorage; treat SQLite as canonical and remove the mirror entirely. | 2 days |

---

## 3. Prioritized 3-month development roadmap

The roadmap is built around the principle stated in `comprehensive_review.md` §5: **three structural changes — Bible schemas, prompt registry, project root — close 70% of the vision gap without touching the well-engineered infrastructure already in place.** Everything else is sequenced behind them.

Effort assumes one engineer, ~70% throughput (rest of time: review, testing, doc sync).

### Month 1 — Foundation (close the structural gaps)

**Goal:** Turn entities into Bibles. Turn one-character-at-a-time into a project. Turn inline strings into a registry.

**Week 1 — Project root + prompt registry skeleton**
- F1 — `projects` table + activate `project_id` columns on `characters`, `prompt_packs`, `generated_images`, `entities`. Header project selector. Filter passthrough on list endpoints. **(Critical, 4 d)**
- G1 — Prompt registry: `api/lib/prompts/library/<slug>.prompt.md` + `getPrompt()`. Migrate `polishCore` first as proof. **(High, 1 w)** *(starts week 1, finishes week 2)*

**Week 2 — Bible schemas (B1)**
- B1 — Per-type Zod Bible schemas (`character`, `location`, `era`, `family`, `prop`). Each declares required + recommended sections + fields. **(Critical, 2 w)**
- G1 finish — migrate the 6 extrapolation prompts + `characterOptimizeCore` + `auditionPrompts` + `qwenPromptCompiler.viewRules` into the registry.

**Week 3 — Bible schemas finish + Markdown export**
- B1 finish — wire schemas to the orchestrator (stage output validation).
- D3 — `GET /api/entities/:id/bible.{md,json}` endpoint + renderer. Export button in editor. **(High, 4 d)**
- B5 — `getBibleCompleteness(entityId)` returning `{ratio, missingRequired, missingRecommended}`. Editor surfaces a ring + per-section badge. **(High, 3 d)**

**Week 4 — Structured outputs + tool calling**
- H1 — Add `tools` and `tool_choice` to provider signatures (`claudeProvider`, `lmStudioProvider`, `ollamaProvider`, `mockProvider`). Migrate S1–S6 to tool-calling rather than `responseFormat: 'json'`. **(Critical, 1 w)**
- D1 + D2 fall out of H1 — Zod schemas on every stage output, with a single repair retry on parse failure.
- G5 — parsers return `{writes, dropped}`; UI surfaces dropped count. **(High, 1 d)**

**Month 1 exit criteria:**
- A Character Bible can be exported as Markdown with a completeness ring.
- All entity work is scoped to an active project.
- Every LLM call goes through a tool-schema enforced JSON path with one repair retry.
- Every prompt in the system has a registry ID and a version.

---

### Month 2 — Universality (make it work for non-characters and ground long-form work)

**Goal:** Location and Era Bibles. Conversational gap-filling. Scenes as first-class records.

**Week 5 — Type-aware extrapolation**
- A3 — Type-aware S1 prompts (Character / Location / Era / Family) dispatched on `entity.type`. **(High, 4 d)**
- B3 — Add `'era'` to entity type CHECK constraint + type-specific S2/S3. **(High, 1 w)**

**Week 6 — Non-character pipeline depth**
- B2 — Replace S3 (psychology) and S5 (portrait visual) with type-specific stages for environment and era (atmosphere/material-culture/period-objects). **(High, 2 w)**
- I3 — SSE endpoint for extrapolation progress events; per-stage progress strip in the editor. **(High, 1 w)** *(parallel)*

**Week 7 — Gap detection + clarification**
- C1 — GapInspector (deterministic, schema-driven, no LLM). Surface in editor as a "Missing" tab. **(Critical, 4 d after B1)**
- C2 — `ClarifyPanel.jsx` + `POST /api/clarify/:entityId` — generates 1–5 directed questions, answers become canon writes. **(High, 1.5 w)**

**Week 8 — Multi-entity seed + scene graph**
- A2 — `POST /api/seed/parse` → S0 splits a synopsis into proto-entities; user confirms before commit. **(High, 1 w)**
- F2 — `scenes` table + `generated_images.scene_id`. Minimal Scenes panel (episode + scene_no + beat + location + time-of-day + wardrobe_state). **(High, 1.5 w starts week 8)**
- C3 — Mid-pipeline pause after S1 if gaps exist (uses C1 + C2). **(Medium, 4 d after C2)**

**Month 2 exit criteria:**
- A Location Bible from "rural Soviet panel-block courtyard, 1989" produces ≥12 canon attributes and an exportable Markdown bible.
- An Era Bible from "Russian Perestroika 1986–1991" produces material-culture, fashion, slang, taboos sections.
- Pasting a 2-paragraph synopsis spins up a proposed cast + locations + era list the user confirms in one step.
- The GapInspector flags missing required fields; the ClarifyPanel offers 1–5 directed questions per gap; answers persist as canon.
- Scenes exist as records and tie generated images to (project, episode, scene, location, time, wardrobe_state).

---

### Month 3 — Consistency & extensibility (long-form film/series readiness)

**Goal:** Drift detection, MCP exposure, universal continuity QA, versioning.

**Week 9 — Visual consistency**
- E5 — Face-similarity drift tracking on ingest. ArcFace/InsightFace step in `comfyService.ingestImage()`, score persisted on `generated_images.similarity_to_anchor`. **(High, 1.5 w)**
- E6 — Universal continuity QA: scenes generated from the entity's own bound era/locations instead of the hardcoded Ruslan fixture. **(High, 1 w)** *(parallel)*

**Week 10 — Reference-image intelligence**
- A4 — Vision-LLM pass on uploaded `visual_anchors` reference; produces `face.*`, `wardrobe.*`, `palette.*` canon writes + CLIP embedding for E5. **(High, 1.5 w)**
- F4 — Index `entity_attributes` and `scenes.narrative_beat` into Chroma; inject top-K matches into S2/S4 prompts. **(Medium, 1 w)** *(parallel start)*

**Week 11 — MCP + agentic loop**
- H2 — `mcp/qpb-server.mjs` exposing `seedEntity`, `runExtrapolation`, `getBible`, `getGaps`, `answerClarification`, `renderScene`. **(High, 2 w starts week 11)**
- F3 — Wardrobe / state evolution table; state-aware prompt compile reads most-recent state ≤ current scene. **(Medium, 1.5 w)** *(parallel)*

**Week 12 — Versioning, polish, hardening**
- H2 finish.
- D4 — `entity_snapshots` table (frozen attribute hash + label). Bible-level snapshot/restore. **(Medium, 1 w)**
- B4 — `'family'` entity type + Family Bible. **(Medium, 5 d, parallel)**
- I3/I4/G4 cleanup — progress events for all long-running calls, request timeouts, prompt-run telemetry table. **(High, 1 w, parallel)**

**Month 3 exit criteria:**
- Every rendered scene has a face-similarity score against the primary anchor; below threshold auto-flags.
- An external LLM (Cursor, Claude Desktop, etc.) can drive QPB via MCP — seed, extrapolate, ask gaps, render, score.
- A Family Bible (e.g. "Levashov family across three Perestroika-era characters") is generatable and exportable.
- Bible snapshots/restore work; one project can hold Draft / Approved sets of the same character.
- Continuity QA runs on any character's own bound era/locations, not a hardcoded fixture.

---

### Explicitly deferred to Quarter 2 (not in this 3-month plan)

| Item | Why deferred |
|---|---|
| E4 — Per-character LoRA training | 3-week scope; only worth it if E5 drift tracking surfaces sustained continuity QA misses after Month 3. Don't pre-build. |
| D5 — Bible diff view | Solo creators rarely need it; cheap to bolt on once D4 ships. |
| H3 — Multi-step agent loop | Sits on top of H1 + H2 + C2; defer until those ship and you've actually used them by hand. |
| H4 — OpenAPI / typed client autogen | Quality-of-life, not vision-critical. Hand-rolled `src/lib/api/*.js` works. |
| I6 — `vite.config.js` extraction | 1.5 w of mechanical work that competes with feature work in Months 1–3. Pay later. |
| I7 — `App.jsx` decomposition | Same logic. Don't block features. |
| Graph DB migration (Neo4j / Dolt) | Existing `entity_relationships` SQL is sufficient through Month 3. Revisit only if relationship traversal becomes hot. |

---

### Critical-path dependency chain (at a glance)

```
F1 (projects) ──► G3 (per-project overrides)
G1 (prompt registry) ──► G2/G3/G4 (versioning, overrides, observability)
B1 (Bible schemas) ──► B5, C1, D1, D3, I1, I5
              └──► D1 ──► D2 (parse + repair)
H1 (tool calling) ──► D1/D2 fall out for free
C1 (gap inspector) ──► C2 (clarify) ──► C3 (mid-pipeline pause)
A3 (type-aware S1) ──► B2 (type-aware S2–S5) ──► B3 (era as entity)
F2 (scenes) ──► F3 (state evolution) ──► state-aware prompt compile
A4 (vision on anchor) ──► E5 (drift tracking)
H2 (MCP server) ──► H3 (agent loop, Q2)
```

The two work fronts that **must not slip** are **B1 (Bible schemas)** and **F1 (projects table)** — both are short, both have ~6 dependents, and both fix things that are silently rotten in the current codebase. Everything else can flex by a week without consequence.

---

## 4. Supporting evidence — file references

For traceability, the claims above derive from these source locations (paths relative to repo root):

- **Bible schema absence:** `src/components/EntityEditor.jsx:10-15` (string-prefix section system), `api/lib/extrapolation/schemas/` (only S1 has a Zod schema)
- **Silent parser drops:** `api/lib/extrapolation/parsers/s2Parser.js:9`, `s3Parser.js`, `s5Parser.js`, `s6Parser.js` (`if (!item?.key) continue`)
- **Provider tool-calling gap:** `api/lib/llm/providers/claudeProvider.js` (no `tools` field), `lmStudioProvider.js:32` (only `response_format`), `ollamaProvider.js`
- **Unused project_id columns:** `api/lib/db/schema.js:4, 17, 30` (all marked `Reserved for Production Room feature (Horizon 2). Not currently used.`)
- **Inline prompts:** `api/lib/polishCore.js:12-99` (88-line system prompt), `api/lib/extrapolation/prompts/sN*.js`, `api/lib/characterOptimizeCore.js:3-17`, `api/lib/prompts/qwenPromptCompiler.js:76-143`
- **Hardcoded continuity QA fixture:** `api/lib/continuity/continuityQaHarness.js:1-39` (Ruslan Levashov + 5 Perestroika scenes hardcoded)
- **MVP Done gate coarseness:** `api/lib/continuity/mvpDoneGate.js:6-49` (5 hard checks, ≥12 canon attributes count)
- **No MCP server / no agentic-flow usage:** `package.json` declares `agentic-flow ^2.0.11`; `rg "agentic-flow"` in `src/` and `api/` returns no imports
- **Vite god-file:** `vite.config.js` line count 2,278 with ~50 inline `server.middlewares.use(...)` blocks
- **App.jsx complexity:** `src/App.jsx` 970+ lines, ~30 `useState` calls
- **ErrorBoundary scope:** `src/main.jsx:6-38` (catches React render crashes only, not API/toast/notification)
- **Stage cache key:** `api/lib/extrapolation/stageCache.js` keyed on `(canon_snapshot, stageId, modelId)` — no reroll salt
- **Reference-image conditioning only:** `api/lib/comfy/ipadapterFeasibility.js` + its test confirm Qwen-Image DiT has no validated IPAdapter chain; `buildComfyPromptPayload` only injects primary anchor bytes

For deeper context on the existing strengths and the architectural risks, see `comprehensive_review.md` in the repo root — it is corroborated against current source and remains accurate.
