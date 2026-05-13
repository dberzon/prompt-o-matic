# Comprehensive Review — Qwen Prompt Builder (QPB)

**Reviewer:** Architectural / senior full-stack review against the stated vision of "a universal tool that takes a seed character description and generates rich, consistent Character / Location / Era Bibles, with intelligent gap detection, structured outputs, and strong support for long-form AI film/series production."

**Reviewed:** May 2026 source tree at `c:\Users\user\Documents\qwen-prompt-builder`. Code wins over docs.

---

## 1. Current Understanding

QPB started as a **cinematic text-to-image prompt builder for Qwen-Image** (director chips → scenario → scene assembler → optional LLM polish). It has since grown three production layers grafted onto that foundation:

1. **Cinematic prompt assembly** (`src/utils/assembler.js`, `src/data/directors.js`, `src/data/chips.js`, `api/lib/polishCore.js`)
   - 61 directors with 1/2/3-character scenario templates (`directors.js` ≈ 1,300 lines)
   - Eight chip dimensions (shot, lens, env/texture, comp, light, color, film, qualifier)
   - Deterministic assembler that orders fragments cinematically and de-dupes via Jaccard similarity
   - Polish endpoint backed by Claude / LM Studio / Ollama / embedded Tauri sidecar

2. **AI actor casting & portfolio rendering**
   - SQLite-backed character lifecycle: `auditioned → preview → portfolio_pending → portfolio_failed → ready`
   - Path A (audition from Character Bank entry → LLM generation → ComfyUI render) and Path B (batch generation with Chroma similarity dedup at 0.18/0.28 thresholds)
   - Per-character prompt-pack compiler (`api/lib/prompts/qwenPromptCompiler.js`) producing portrait/audition/cinematic-scene views
   - ComfyUI workflow mapping with dry-run, validation, multi-job status, ingest, SSE render events

3. **Worldbuilding & Continuity Intelligence layer** (the most recent addition, per `docs/proposals/worldbuilding-continuity-system.md`)
   - `entities` table (type ∈ `character | environment | prop | institution | location | era`)
   - Provenance-tracked `entity_attributes` (`canon | inferred | suggested | temporary | derived`)
   - `entity_relationships`, `visual_anchors`
   - **Type-aware extrapolation** (`api/lib/extrapolation/stageRegistry.js` + `orchestrator.js`): character-shaped types use six stages (S1 entity extraction · S2 historical/cultural · S3 psychology · S4 environment projection · S5 visual descriptor · S6 conflict detection). **`location`** uses three stages (geography, inhabitants, history). **`era`** currently registers a placeholder no-op chain.
   - **MVP Done gate** (`api/lib/continuity/mvpDoneGate.js`) with 5 prerequisites and 5-scene blind-seed reviewer scoring (face/body/wardrobe ≥ 4/5)
   - Entity → prompt pack compiler that maps canon/inferred/derived attrs onto the legacy `CharacterProfile` shape

### High-level architecture

```
src/                       — React 18 + Vite frontend (5 tabs)
  App.jsx                  — 970-line root, tab switching, localStorage state
  components/              — UI per tab (Prompt Builder, Character Builder,
                             Casting Room, Actor Bank, Continuity)
  hooks/                   — usePolish, useCharacterOptimize, useComfyHealth
  utils/                   — assembler.js, promptRules.js, variants.js
  lib/api/                 — typed fetch wrappers per /api/* domain
  data/                    — 61 directors, chips, presets, scene bank/deck

api/                       — Vite middleware route handlers
  *.js                     — one file per route (entities, comfy-*, polish, …)
  lib/                     — domain logic (the third layer)
    polishCore.js          — provider resolution + polish prompt
    llm/providers/         — claude / lmstudio / ollama / mock
    db/                    — better-sqlite3, schema, repositories, guard
    characters/            — legacy character pipeline + batch generation
    extrapolation/         — `stageRegistry.js` + orchestrator: character-shaped S1–S6, location 3-stage, era placeholders; prompts/, parsers/, schemas/, stageCache.js
    continuity/            — MVP Done gate, QA harness, scoring, anchors
    comfy/                 — workflow mapping, queue, SSE service
    prompts/               — Qwen prompt compiler, negative library, entity→profile shim
    vector/                — Chroma store, character/entity indexing
    portfolio/, audition/, embeddings/, postMvp/
```

**Crucial topology:** there is **no separate API server**. All ~55 `/api/*` endpoints are registered as Vite dev-server middlewares in `vite.config.js` (the file is 2,278 lines). `npm run dev` runs the entire stack. The same code path serves a Tauri desktop build via the embedded `llama-server` sidecar.

**Provider resolution chain (`polishCore.js`):** embedded → local (Ollama or LM Studio per `LLM_PROVIDER`) → Claude cloud. Local-only flag short-circuits cloud. Auto mode tries embedded first.

**Data layer:** SQLite (`data/qpb-local.sqlite`) is canonical, 14+ tables, all writes through repository functions. Chroma is a rebuildable semantic index used only for character similarity. localStorage holds custom presets, AI engine pref, and a UI cache of character bank entries.

---

## 2. Strengths — What is Already Well Implemented

### 2.1 Clear three-layer separation and tight modules
- `src/components/*` → React UI (one component per file)
- `api/*.js` → thin route handlers, mostly under 100 lines
- `api/lib/<domain>/` → domain logic (the "real" code)
- Tests sit next to source (`foo.js` + `foo.test.js`) and there are *many* of them — `ruslanMvpAcceptance.test.js`, `mvpDoneGate.test.js`, `extrapolation.test.js`, `entityAttributesProvenanceGuard.test.js`, `qwenPromptCompiler.test.js`, etc.

### 2.2 Provenance discipline is genuinely good
- `entity_attributes` has a DB-level `CHECK` on provenance (`api/lib/db/schema.js:187`).
- All writes go through `writeAttribute()` in `api/lib/db/repositories.js:1192` which enforces provenance, supports `supersedes` chains, and runs inside a transaction.
- `api/lib/db/entityAttributesProvenanceGuard.test.js` is a build-time guard that scans the source tree and fails if any non-test file does a raw `INSERT INTO entity_attributes`. That is a level of design rigor most projects never reach.
- Editing an inferred attribute promotes it to canon and supersedes the original — history is preserved (`promoteToCanon`, `supersedeAttributeBy`).

### 2.3 The polish system prompt is craft-level
`api/lib/polishCore.js:12-99` is a 88-line system prompt that encodes serious cinematography: 60–110 word target, anti-CGI anchors, passive figures, single light source, named film stocks, per-director compositional logic for 15 named auteurs plus a generic fallback. It reads like a cinematographer's brief — not a checklist. This is a real asset.

### 2.4 Extrapolation pipelines (type-aware) with the right ergonomics
- Stage chain is selected from entity `type` (`chainFor` in `stageRegistry.js`). Character-shaped entities still run S1–S6; `location` runs three structured stages; `era` is a stub until implemented.
- Stage cache is keyed by `(canon_snapshot, stageId, modelId)` and stored as JSON on disk (`data/extrapolation-stage-cache/`). Re-running with unchanged canon is free.
- Parallel middle stages (S2–S5) gated by env flag `EXTRAPOLATION_PARALLEL_STAGES_2_5` — sensible default off, opt-in for speed.
- Per-stage model routing via `EXTRAPOLATION_STAGE_MODELS` JSON env var. (`modelRouting.js`)
- Orchestrator supports `onStageComplete` callback for progressive UI updates and `shouldCancel` for user cancellation.
- The 5-scene continuity QA with **blind-seed scoring** (`continuityQaScoring.js`) is the right way to validate identity preservation. Threshold ≥4/5 across face/body/wardrobe is a real acceptance bar — not vanity metrics.

### 2.5 Character lifecycle, archive, and orphan cleanup
- The `lifecycle_status` state machine (`api/lib/characterLifecycle.js`) cleanly separates audition / preview / portfolio / ready states.
- `vite.config.js:267-276` proactively garbage-collects orphaned `preview` characters older than one hour on each dev-server startup. Small detail, big quality signal.

### 2.6 ComfyUI integration is robust for a single-user tool
- Persistent `comfy_jobs` table survives reloads (`schema.js` migration 6, repositories `upsertComfyJob`, `bulkUpsertComfyJobs`).
- SSE render-event broadcaster with sliding-window dedup of `seenPromptIds` and a 2-second poll that *skips* when there are zero active jobs (`vite.config.js:225-255`) — non-trivial defensive work.
- Workflow validator, dry-run mode, and an `allowWorkflowFallback` toggle so unknown workflow IDs fail loudly by default.

### 2.7 Schema-first character profiles
`api/lib/characters/schemas.js` (Zod) enforces a tight `CharacterProfileSchema`: required face structure (shape/eyes/eyebrows/nose/lips/jawline), wardrobe, archetype, distinctive features. Every repository write goes through `parseCharacterProfile()` so bad data cannot reach disk.

---

## 3. Major Gaps vs. the Vision

The vision is "**universal Character / Location / Era Bibles** with **intelligent gap detection**, **structured outputs**, and **long-form film/series support**." Against that bar, here is where the codebase is short.

### 3.1 No formal "Bible" concept — entities are flat attribute bags

The Worldbuilding proposal (`docs/proposals/worldbuilding-continuity-system.md`) sketches characters, environments, props, institutions (and the shipped DB adds `location` and `era`), but in code there is **no Bible schema**. A "Character Bible" today is:

- ~12+ attributes the LLM happened to produce, keyed by dotted strings
- A primary reference image
- A single `visual.descriptor` string from S5

There is no template that says "a complete Character Bible has Demographics, Physical Description, Wardrobe, Voice & Speech, Psychology, History, Relationships, Distinctive Features, Forbidden Confusions, Reference Visuals." The frontend `EntityEditor.jsx:10-15` hardcodes section *names* per type but those sections only show attributes whose key starts with `section.toLowerCase()`. There is no required-field list, no completeness measure, no schema.

**Location Bibles** — You can now create `entities` with `type='location'` and run a dedicated three-stage extrapolation chain (`api/lib/extrapolation/stages/location/`). There is still no formal "Bible schema" or completeness ring; attributes remain LLM-keyed bags.

**Era Bibles** — `type='era'` exists in the schema and `stageRegistry`, but stages are no-op placeholders until an era pipeline is implemented. Narrative era context still often lives on character or environment attributes (e.g. `setting.era`).

### 3.2 Gap detection is essentially absent

The closest thing to gap detection is `MVP_DONE_GATE_MIN_CANON_ATTRIBUTES = 12` in `api/lib/continuity/mvpDoneGate.js:6`, which only checks **five hard prerequisites** for the continuity QA gate:

```js
[
  'character entity exists',
  'at least one environment entity exists',
  'primary reference anchor',
  'visual.descriptor attribute present',
  '>= 12 canon attributes'
]
```

That is a coarse readiness gate, not gap detection. It cannot tell the user:

- "Your wardrobe is empty"
- "You have facial structure but no body posture"
- "No speech register has been inferred"
- "You have a Soviet-era setting but no period-appropriate slang or objects"
- "Your character has a relationship to Rita but Rita has zero canon attributes"

Stage 6 (`s6ConflictDetection.js`) detects **contradictions**, not **omissions**. The whole "review-and-approve" UX from the proposal (`docs/proposals/...md` §8) leans on the LLM to suggest content, but never asks "what's missing?" prescriptively.

### 3.3 Structured outputs are half-implemented

Only **S1** has a real Zod schema (`api/lib/extrapolation/schemas/s1EntityExtraction.js`). S2–S6 parse outputs through `parseJsonFromLlmText()` and silently drop invalid items:

```js
// api/lib/extrapolation/parsers/s2Parser.js:8
for (const item of attributes) {
  if (!item?.key) continue   // <- silent drop
  ...
}
```

S3 enforces `behavior.* | speech.* | fear.*` prefixes — but everything else is freeform. S5 (the most visually consequential stage) returns a *single* `visualDescriptor` string and parses with `parsed?.visualDescriptor || parsed?.['visual.descriptor']` — no structured face/body/wardrobe break-out, so the prompt-pack compiler in `entityAttributeProfile.js` has to *manually* alias keys (`faceShape`, `eyes`, …) back together from canon attributes elsewhere.

Provider calls are made with `providerPayload: { responseFormat: 'json' }` (`stages.js:32`) but no JSON-schema-mode is used despite LM Studio supporting `response_format.json_schema` and Claude supporting tool schemas. Every stage just hopes the LLM returns parseable JSON and silently swallows half-outputs when it doesn't.

There is **no retry/repair loop**: if a stage parse fails, the orchestrator returns empty writes and moves on.

### 3.4 Consistency mechanisms are minimal and brittle

- **IPAdapter is spec-only.** `api/lib/comfy/ipadapterFeasibility.js` and its test confirm Qwen-Image DiT has no validated IPAdapter chain. The "primary reference anchor" mechanism today is just "primary reference image bytes get injected into the workflow mapping" — that's reference image conditioning, not identity locking.
- **Per-character LoRA is explicitly deferred** (P2). Recommendation comments in `continuityQaScoring.js:9` mention "Escalate to per-character LoRA training" if QA scores miss, but there's no code path for it.
- **No identity embedding cache**. `ipadapterEmbeddingCache.js` exists but is plumbing for a feature that has nowhere to live until Qwen-Image gets IPAdapter support.
- **No cross-shot drift tracking.** Once a generation lands, there's no automated face-similarity check against the primary anchor (could be done with the existing embeddings provider — character text embeddings exist but no image-embedding pipeline).
- **Continuity QA scenes are hardcoded** to a single Russian-Perestroika fixture in `api/lib/continuity/continuityQaHarness.js:3-39`. The harness is supposed to be the universal acceptance gate, but it is wired specifically to Ruslan Levashov's world.

### 3.5 Memory and cross-document context is missing

The schema has `project_id` columns on `characters`, `prompt_packs`, `generated_images` — but `APPLICATION_REFERENCE.md` confirms they are "Reserved for Production Room feature (Horizon 2). Not currently used." (`schema.js:3`, `:17`, `:30`)

This means:
- No way to group "the cast + locations + era + scenes of *my Perestroika film*" under one project root.
- No way to write Scene 17 of Episode 3 and inherit context from prior scenes (wardrobe state, time-of-day continuity, location stage).
- No timeline / scene graph. `generated_images` is keyed by `characterId` and `promptPackId` — flat, with no temporal order beyond `created_at`.
- No way to encode "in Act 2 Ruslan loses his jacket" as a wardrobe-state change that subsequent renders should inherit.

For a tool aimed at *long-form film/series production*, this is the biggest single architectural gap.

### 3.6 Extrapolation is character-centric

Despite the entity schema admitting `environment | prop | institution`, the pipeline assumes a character:

- S1 prompt (`s1EntityExtraction.js:9`) says "Primary entity receives detailed canon attributes (appearance, setting, relationships)." Environments and props get "minimal canon attributes (usually name only)."
- S3 hardcodes psychology prefixes — meaningless for a location.
- S4 generates environments *from* a character; there is no inverse track for enriching an existing environment with characters that inhabit it.
- S5 is "visual descriptor for *Qwen image generation* … Prefer frontal portrait composition with neutral expression." (`s5VisualDescriptor.js:9`) — a portrait-shaped prompt. Useless for a Location Bible.

So a Location Bible today is whatever attributes S4 happens to leak about a side-effect environment entity. There is no equivalent S2/S3 enrichment for locations (period-appropriate fixtures, weather logic, era-specific decay patterns). Era Bibles do not exist at all.

### 3.7 Two parallel character systems with brittle bridging

The legacy `characters` table (Character Builder → Casting Room → Actor Bank) and the new `entities` table overlap heavily but live in parallel:

- `entityAttributeProfile.js:32-56` defines `PROFILE_FIELDS` — a hardcoded translation layer that maps entity attributes (`faceShape`, `eyes`, etc.) back onto the legacy `CharacterProfileSchema`.
- `ENTITY_PROFILE_DEFAULTS` (`entityAttributeProfile.js:58-80`) fills missing fields with strings like `'unspecified face shape'`, `'unspecified eyes'` — so a Character Bible derived from an entity can pass schema validation even with no actual content. This is a silent quality-of-output hole.
- `api/entity-lift-from-bank.js` exists to migrate Character Bank entries → entities, one-way and on-demand. There is no live sync.

A Character Bible rich with Stage-2 cultural and Stage-3 psychological context cannot flow into the cinematic Prompt Builder tab without first being lifted, then routed through the prompt-pack compiler which strips most of that context away into the legacy profile shape.

### 3.8 Prompt management is fragmented and version-less

Every prompt in the system is an inline JS string template:

- `polishCore.js:12-99` — polish system prompt
- `characterOptimizeCore.js:3-17` — character optimize prompt
- `extrapolation/prompts/s1..s6` — six stage prompts (each its own file but each just a `.join('\n')` of literal lines)
- `auditionPrompts.js`, `promptDescriptor.js` — more inline prompts
- `qwenPromptCompiler.js:76-143` — `viewRules` hardcodes camera/lens/lighting per view as JS literals

Consequences:
- No prompt registry — no list of "all prompts in the system."
- No prompt versioning — changing a stage prompt is just an edit; rollback is git.
- No per-project / per-genre prompt overrides ("polish for *art horror* vs *kitchen-sink realism*").
- No A/B testing infrastructure.
- The 88-line polish prompt is excellent but it's bound to one aesthetic register (Tarkovsky/Lynch/Haneke/etc.) — there's no swap point.

### 3.9 Frontend Bible editor is shallow

`EntityEditor.jsx` is the closest thing to a Bible UI. It:

- Hardcodes section names per type in a 6-line constant (`EntityEditor.jsx:10-15`)
- For each section just renders `<CanonAttributesPanel sectionPrefix={section.toLowerCase()} />` — meaning attributes whose key happens to start with that lowercase prefix
- Shows `AttributeReviewPanel`, `EntityConflictPanel`, `EntityExtrapolationPanel` as flat stacks below
- Has no completeness indicator, no required-field highlighting, no "missing" badges, no progress meter

For a tool whose unique value proposition is "rich Character Bible from a seed", the Bible **viewing surface** is its weakest link. The reviewer/approval flow described in the proposal §8 ("review inferred attributes: per attribute → keep / promote / edit / reject") exists in `AttributeReviewPanel.jsx` but is flat — a list, not a Bible.

### 3.10 No timeline / scene graph for series production

`generated_images` and `comfy_jobs` are flat tables. Scenes do not exist as records. Episodes do not exist. Wardrobe state cannot evolve. There is no "Scene 12, Ruslan in the beer hall on the night Rita leaves" record that ties (`character_id=ruslan, location_id=beer_hall, era_state=perestroika_late, wardrobe_state=after_jacket_loss`).

### 3.11 No versioning or branching of Bibles

Individual attributes have supersede chains. But there is no:
- "Draft Bible vs Approved Bible" version
- "What-if branch" (alternate Ruslan at 35 instead of 22)
- Bible diff / compare view
- Snapshot / restore semantics at the Bible level

For collaborative or iterative writing, this would matter. For solo film prep, it would still matter because creators frequently fork-and-prune.

### 3.12 Vector store is under-used

Chroma is plumbed and auto-started (`vite.config.js:164-197`) but is only used for:
- Batch dedup similarity check (0.18 / 0.28 thresholds)
- "Save to Cast" re-check
- A handful of vector maintenance endpoints

It is **not** used for:
- Semantic attribute retrieval ("find characters with similar wardrobe energy")
- Era / location lore retrieval to ground Stage 2
- Scene retrieval ("find the closest existing scene to this one for inspiration")
- Reference image retrieval (could replace the manual primary-anchor pick)

The infrastructure cost is paid; the value is not extracted.

---

## 4. Architectural Issues

### 4.1 `vite.config.js` is a 2,278-line god-file

About 50 `server.middlewares.use(...)` blocks live in this single file. Most contain 30–60 lines of inline business logic. Inconsistency: some routes were extracted to `api/entities.js`, `api/entity-anchors.js`, etc. and dispatched via regex middleware at the end (`vite.config.js:973-1103`); others remain inline (`/api/comfy-status`, `/api/polish`, `/api/character-batches`, `/api/character-rename`, `/api/character-archive`, `/api/optimize-character`, `/api/characters-generate-batch`, …).

Cost of the inconsistency:
- New routes are usually pasted inline → file keeps growing
- Inline handlers can't be unit-tested via the Vite plugin (workarounds exist but the route logic is intertwined with `server.middlewares.use` signatures)
- Cold start parses the entire file every time
- A single typo here breaks every route

This is the single highest-effort/highest-reward refactor target.

### 4.2 `App.jsx` is 970+ lines with mixed responsibilities

Tab routing, share-link encode/decode (with migration), workspace profile load + legacy localStorage migration, character cache, scene/preset/blend application, ApplyDiff capture, embedded sidecar polling, hash-state restore on mount — all in one component. The component has roughly 30 `useState` hooks. Splitting into context + child components is overdue.

### 4.3 `createVectorRuntime` opens a fresh SQLite handle per request

Almost every middleware does `runtime = createVectorRuntime({ env })` at the top and `runtime?.close?.()` in `finally`. For a dev-mode tool on local SQLite this is *workable*, but it means:
- DB open + WAL setup happens on every request
- The migrations array runs through `initializeDatabase` on every open (idempotent but wasteful)
- Connection pooling is non-existent; long polling loops thrash file handles

A single long-lived `db` plus a per-request transaction would be cleaner.

### 4.4 Stage parser fragility (already noted in §3.3)

Every parser does `if (!item?.key) continue` and silently drops malformed items. There is no log of dropped items, no diagnostic surface, no retry. Subtle prompt regressions become invisible.

### 4.5 Cache key is too conservative for iteration

`stageCache.js` hashes `(canon_snapshot, stageId, modelId)`. That is correct for "re-running with unchanged canon should be free." But it is also too conservative when the user wants to *re-roll* an inferred attribute set without changing canon. Today, the only way to bust the cache is to (a) change a canon attribute, (b) change `EXTRAPOLATION_STAGE_MODELS`, or (c) delete the cache file from disk. There is no UI "regenerate stage" button that injects a salt.

### 4.6 Provider abstraction leaks at every call site

`api/lib/extrapolation/llm.js` is a 22-line wrapper but only over `resolveProviderSelection + runWithResolvedProvider`. Every middleware in `vite.config.js` that needs an LLM rebuilds its own `llmGenerate` closure inline (search for `llmGenerate = async ({ system, user, providerPayload })` — at least 5 copies in `vite.config.js`). This is begging for a single shared factory.

### 4.7 No request-level timeout or budget

LLM stages can run for minutes (the proposal acknowledges ~2–4 minutes per pass on M4 Pro). There is no per-request hard timeout, no progress streaming to the client beyond `onStageComplete`, no SSE for extrapolation (SSE exists only for ComfyUI render events).

### 4.8 No prompt observability

No way to see the *actual* prompt that went out for a given stage call. `usePolish.js` has dev debug capture, but extrapolation stages don't. Combined with §4.4 silent parser drops, this makes debugging an extrapolation regression very expensive.

### 4.9 `EntityEditor`'s section system is a string-prefix hack

`SECTIONS_BY_TYPE` (`EntityEditor.jsx:10-15`) maps a tab name (`"Wardrobe"`) to a string prefix (`"wardrobe"`) and shows only attributes whose key starts with that prefix. There is no schema saying "Wardrobe requires `wardrobe.upper`, `wardrobe.lower`, `wardrobe.footwear`, `wardrobe.outerwear`." So a user moving between sections cannot tell what each section *should* contain.

### 4.10 Localstorage / SQLite mirror in Character Builder is fragile

`CharacterBuilder.jsx:45-81` loads bank entries from `/api/character-bank` on mount and then overwrites localStorage. If the user is editing while this resolves, edits are lost. A small but real correctness hole.

---

## 5. Quick Wins (Highest Impact / Effort Ratio)

These three changes would push QPB much closer to its stated vision without a structural rewrite.

### 5.1 Add a Bible Schema layer with structured outputs and gap detection

**What:** Define per-entity-type Zod schemas describing a *complete* Bible:

```
api/lib/bibles/
  characterBible.schema.js
  locationBible.schema.js
  eraBible.schema.js
  propBible.schema.js
```

Each schema specifies required sections (Demographics, Physical, Wardrobe, Voice, Psychology, History, Relationships, Visuals) with required/recommended fields per section.

**Why this is the single highest-leverage change:**
- Drives a `getBibleCompleteness(entityId)` function: returns `{ ratio: 0.74, missingRequired: [...], missingRecommended: [...] }`. Surface as a completeness ring in `EntityEditor`. *That is gap detection.*
- Reshapes Stage prompts to demand JSON conforming to the schema (use LM Studio `response_format.json_schema` and Claude tool schemas). Brittle freeform parsing in S2–S6 disappears.
- Gates `mvpDoneGate` on schema completeness rather than the current `≥12 canon attributes` heuristic.
- Unlocks the **Location Bible** and **Era Bible** promises: define the schemas, add type-specific stage prompts, done.

**Effort:** ~3–5 days for one type-specific Bible (Character) end-to-end with UI; ~1 day each for additional types if the framework is generic.

### 5.2 Externalize prompts into a versioned registry

**What:** Move every LLM prompt out of `.js` source into `api/lib/prompts/library/<slug>.prompt.md` with frontmatter:

```
---
id: extrapolation.s1.entityExtraction
version: 3
inputSchema: ./schemas/s1Input.zod.js
outputSchema: ./schemas/s1Output.zod.js
description: Extract entities + canon attributes from sparse character notes.
---
Extract entities and canon attributes from sparse character notes.
{{#each rules}}
- {{this}}
{{/each}}
...
```

Provide `getPrompt(id, version?)`. Wire S1–S6, polish, character-optimize, audition, and view-rules through it.

**Why:**
- A/B testing prompts becomes a one-line config change.
- A future devtool can list "every prompt in the system, sorted by version."
- Per-project overrides ("this series uses the *Eggers* polish prompt, not the default") become trivial.
- Pulling 88-line system prompts out of `.js` makes diffs readable.

**Effort:** ~2 days for the registry + migration of the existing ~10 prompts. Drop-in change; backwards compatible.

### 5.3 Introduce a `projects` (or `productions`) root entity

**What:** Add a `projects` table, wire the existing-but-unused `project_id` columns on `characters`, `prompt_packs`, `generated_images`, plus `entities` (add the column). Add a tiny project selector in the header. Every page becomes "what is the active project?"

**Why:**
- This is the single change that turns QPB from "a tool for one character at a time" into "a tool for a series." Today's flat tables already have the column waiting.
- Unlocks downstream features that are otherwise blocked: project-level prompt overrides (combine with 5.2), project-level Era Bible that all characters inherit, project-level continuity QA scenes (replace the Ruslan-hardcoded fixture in `continuityQaHarness.js`).
- Tiny implementation: the FK columns exist, the schema migration is one line per table, the UI is one dropdown.

**Effort:** ~1–2 days for the migration + minimal selector + filter passthrough.

---

### Honourable mentions (if you want a 4th)

- **Extend type-aware extrapolation beyond the shipped tracks.** `stageRegistry.js` already dispatches: character-shaped S1–S6, `location` three-stage pipeline, `era` placeholders. Remaining work: real `era` stages, richer environment/prop-specific prompts if desired, and optional S1 prompt/schema updates so extracted secondary entities can include `location` / `era` when appropriate.
- **Add a stage-level "regenerate with new seed"** button that salts the cache key (`stageCache.js`). One line of code, removes a real iteration pain.
- **Surface dropped items.** When `s2Parser.js`, `s3Parser.js`, etc. drop a malformed item, log it on the stage result so the UI can show `"3 attributes returned, 1 dropped (missing key)"`. Tiny, hugely valuable for debugging.

---

## 6. Summary

QPB has done the **hard infrastructure work** — provenance discipline, stage caching, lifecycle state machines, ComfyUI workflow validation, Zod schemas at the legacy boundary, a 5-scene blind-seed continuity QA gate — and the **excellent craft work** at the cinematic-prompt layer (61 directors, an 88-line polish prompt that knows what it's doing).

What is missing is the **product layer that turns those pieces into a "universal Bible builder."** There is no Bible schema, no gap detection, no Location / Era types, no project root, no prompt registry, no series timeline. The frontend Bible editor is a flat attribute list dressed with section-name tabs. Half the stage outputs are unstructured strings the LLM tossed over the wall.

Three changes — **Bible schemas with gap detection**, **a prompt registry**, **a project root** — would close the largest gap between current behavior and stated vision without touching the well-engineered infrastructure already in place. The codebase is ready for them; the column on `characters.project_id` has been sitting empty since Migration 0 waiting for exactly this.
