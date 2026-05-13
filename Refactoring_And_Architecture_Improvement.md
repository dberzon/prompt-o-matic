# Refactoring & Architecture Improvement Plan

**Project:** Qwen Prompt Builder → Character & World Bible
**Author:** Architectural review, May 2026
**Source tree reviewed:** `c:\Users\user\Documents\qwen-prompt-builder`
**Companion document:** `comprehensive_review.md` (diagnosis of current state)

This document is the operational architecture that implements the three quick wins in `comprehensive_review.md` (Bible schemas, prompt registry, project root) plus four additional dimensions: centralized prompts with versioning + few-shot, long-term memory, MCP-ready tool surface, and reliable JSON output.

---

## A. What This Plan Does NOT Touch (and Why)

No full rewrite. The expensive load-bearing infrastructure is correct and must be preserved:

- Provenance discipline + `writeAttribute` guard (`api/lib/db/entityAttributesProvenanceGuard.test.js`, `api/lib/db/repositories.js`)
- Stage cache keyed on `(canon_snapshot, stageId, modelId)` (`api/lib/extrapolation/stageCache.js`)
- Lifecycle state machine + orphan GC
- Zod at the legacy boundary (`api/lib/characters/schemas.js`)
- 88-line cinematic polish system prompt (`api/lib/polishCore.js` lines 12–99) — high craft value, do not regress
- LM Studio / Ollama / Claude / embedded / mock providers

The architectural work happens **above** these primitives: prompt management, schema-driven outputs, project memory, agent/tool surface, UI separation.

---

## B. Recommended Project Structure

Target state. Boxes marked `(new)` are net new; `(move)` means existing code relocates; `(extract)` means logic lifted out of `vite.config.js` or `App.jsx`.

```
qwen-prompt-builder/
├─ src/                                   # Frontend (React 18, Vite)
│  ├─ app/                                # (new) app shell
│  │  ├─ AppRoot.jsx                      # was App.jsx — thin, ~150 lines
│  │  ├─ AppRoutes.jsx                    # tab routing only
│  │  ├─ shareLink/                       # (extract) encodeShareState/decodeShareState
│  │  └─ workspaceProfiles/               # (extract) localStorage + remote sync
│  │
│  ├─ context/                            # (new) cross-cutting contexts
│  │  ├─ ProjectContext.jsx               # active project (production)
│  │  ├─ PromptStateContext.jsx           # scene/director/chars/chips slice
│  │  ├─ EngineContext.jsx                # engine, localOnly, provider health
│  │  └─ ToastContext.jsx
│  │
│  ├─ features/                           # (new) feature-folder layout
│  │  ├─ promptBuilder/                   # ex src/components/* prompt UI
│  │  │  ├─ PromptBuilder.jsx
│  │  │  ├─ assembler/                    # (move) src/utils/assembler.js etc.
│  │  │  ├─ rules/                        # (move) promptRules.js
│  │  │  └─ ...
│  │  ├─ characterBuilder/
│  │  ├─ castingRoom/
│  │  ├─ actorBank/
│  │  └─ bible/                           # (new) replaces flat Continuity tab
│  │     ├─ BibleEditor.jsx               # schema-driven, replaces EntityEditor
│  │     ├─ BibleSectionPanel.jsx         # one section = one Zod sub-schema
│  │     ├─ CompletenessRing.jsx          # gap detection visual
│  │     ├─ AttributeReviewPanel.jsx      # (move)
│  │     ├─ ConflictPanel.jsx
│  │     └─ ExtrapolationProgress.jsx     # SSE-driven
│  │
│  ├─ lib/
│  │  ├─ api/                             # fetch wrappers (one per domain)
│  │  │  ├─ http.js                       # already exists
│  │  │  ├─ bibles.js                     # (new)
│  │  │  ├─ projects.js                   # (new)
│  │  │  └─ ...
│  │  └─ shareLink.js
│  │
│  └─ ui/                                 # primitives (Button, Field, Modal)
│
├─ api/
│  ├─ routes/                             # (move + extract) one file = one route
│  │  ├─ _registry.js                     # (new) central registry + binder
│  │  ├─ polish.js, polish-health.js
│  │  ├─ entities.js, entity-*.js
│  │  ├─ bibles/                          # (new) /api/bibles/*
│  │  │  ├─ get.js, completeness.js,
│  │  │  ├─ extrapolate.js                # SSE
│  │  │  └─ approve-section.js
│  │  ├─ projects/                        # (new) /api/projects/*
│  │  └─ ...all other current api/*.js
│  │
│  ├─ lib/                                # domain layer
│  │  ├─ llm/                             # provider abstraction
│  │  │  ├─ providers/                    # claude/lmstudio/ollama/mock/embedded
│  │  │  ├─ client.js                     # (new) ONE shared createLlmClient()
│  │  │  ├─ resolver.js                   # (extract) resolveProviderSelection
│  │  │  ├─ structuredOutput.js           # (new) JSON mode + repair + retry
│  │  │  └─ telemetry.js                  # (new) prompt+response capture
│  │  │
│  │  ├─ prompts/                         # PROMPT REGISTRY (versioned)
│  │  │  ├─ registry.js                   # (new) getPrompt(id, version?)
│  │  │  ├─ render.js                     # (new) handlebars-lite renderer
│  │  │  ├─ schemas/                      # zod schemas per prompt
│  │  │  └─ library/                      # *.prompt.md with frontmatter
│  │  │     ├─ polish.system.v1.prompt.md
│  │  │     ├─ extrapolation.s1.entityExtraction.v3.prompt.md
│  │  │     ├─ extrapolation.s2.historical.v2.prompt.md
│  │  │     ├─ bible.character.gap.v1.prompt.md   # (new) gap detection
│  │  │     ├─ bible.location.gap.v1.prompt.md    # (new)
│  │  │     ├─ characterOptimize.v1.prompt.md
│  │  │     └─ fewshot/                   # (new) shared exemplars
│  │  │
│  │  ├─ bibles/                          # (new) BIBLE LAYER — the product spine
│  │  │  ├─ schemas/
│  │  │  │  ├─ characterBible.schema.js   # Zod, with required/recommended fields
│  │  │  │  ├─ locationBible.schema.js
│  │  │  │  ├─ eraBible.schema.js
│  │  │  │  └─ propBible.schema.js
│  │  │  ├─ completeness.js               # (new) getBibleCompleteness()
│  │  │  ├─ projection.js                 # entity attrs → Bible shape
│  │  │  ├─ gapDetector.js                # (new) drives "What's missing"
│  │  │  └─ approval.js                   # (new) section-level approve/reject
│  │  │
│  │  ├─ extrapolation/                   # six-stage pipeline (mostly intact)
│  │  │  ├─ orchestrator.js               # (refactor) dispatch on entity.type
│  │  │  ├─ stages/
│  │  │  │  ├─ character/                 # current S1..S6 logic
│  │  │  │  ├─ location/                  # (new) location-aware stages
│  │  │  │  └─ era/                       # (new) era-aware stages
│  │  │  ├─ parsers/                      # add dropDiagnostics
│  │  │  ├─ stageCache.js
│  │  │  └─ progressBus.js                # (new) SSE source
│  │  │
│  │  ├─ projects/                        # (new) PROJECT MEMORY
│  │  │  ├─ repository.js
│  │  │  ├─ context.js                    # current project resolver
│  │  │  └─ scenes.js                     # scene graph (post-MVP)
│  │  │
│  │  ├─ agents/                          # (new) MCP-READY TOOL SURFACE
│  │  │  ├─ toolRegistry.js               # tool catalog
│  │  │  ├─ tools/
│  │  │  │  ├─ getCharacterBible.tool.js
│  │  │  │  ├─ writeAttribute.tool.js
│  │  │  │  ├─ detectGaps.tool.js
│  │  │  │  ├─ runExtrapolation.tool.js
│  │  │  │  └─ ...
│  │  │  ├─ adapters/
│  │  │  │  ├─ mcpServer.js               # exposes tools over MCP stdio
│  │  │  │  └─ httpAdapter.js             # exposes tools over /api/agents/*
│  │  │  └─ executor.js                   # runs a tool call, validates I/O
│  │  │
│  │  ├─ db/                              # repositories (unchanged location)
│  │  │  ├─ schema.js                     # + projects, + bible_snapshots, + scenes
│  │  │  ├─ migrations/                   # (refactor) one file per migration
│  │  │  └─ repositories/                 # split repositories.js (52k!) by table
│  │  │     ├─ entities.js
│  │  │     ├─ entityAttributes.js
│  │  │     ├─ projects.js
│  │  │     └─ ...
│  │  │
│  │  ├─ characters/, continuity/, comfy/, vector/, embeddings/   # mostly as-is
│  │  └─ http.js                          # already exists
│  │
│  └─ vite-plugin/
│     ├─ index.js                         # registers routes via api/routes/_registry
│     ├─ chromaSupervisor.js              # (extract) auto-start Chroma
│     └─ comfySsePoller.js                # (extract) SSE poller
│
├─ scripts/
│  ├─ prompts-list.mjs                    # (new) `npm run prompts:list`
│  └─ prompts-diff.mjs                    # (new) diff two prompt versions
│
├─ docs/proposals/architecture-v2.md      # this document
└─ vite.config.js                         # <300 lines: pluginize the dev server
```

Net effect: `vite.config.js` shrinks from 2,277 lines to <300, `App.jsx` from 1,169 to <200, and every route handler lives in one place.

---

## C. Key Architectural Changes

### C1. Unify the LLM call site — one `LlmClient` everywhere

Today `vite.config.js` has **four duplicate** `llmGenerate = async ({ system, user, providerPayload })` closures, plus `api/lib/extrapolation/llm.js` is a 22-line wrapper around `resolveProviderSelection` + `runWithResolvedProvider`. Every other middleware reimplements this.

**Replace with a single `LlmClient`:**

```js
// api/lib/llm/client.js
export function createLlmClient({ env = process.env, fetchImpl = fetch, telemetry } = {}) {
  return {
    async chat({ promptId, version, variables, schema, retry }) { ... },
    async raw({ system, user, providerPayload }) { ... },
    async stream({ ... }) { ... }, // future
  }
}
```

Properties:
- Takes a **prompt id**, not raw strings → forces use of the registry.
- Takes a **Zod output schema** → applies `response_format.json_schema` for LM Studio, tool schema for Claude, prompt prefix `Return strict JSON only.` for Ollama.
- Bundles repair + retry + telemetry in one place.
- Every consumer (`runExtrapolationStage`, polish, character-optimize, gap detector, agents) goes through it.

### C2. Prompt registry — markdown + frontmatter + version

Each prompt is a markdown file with frontmatter; the registry loads them at startup and exposes `getPrompt(id, version?)`:

```markdown
---
id: extrapolation.s1.entityExtraction
version: 3
description: Extract entities and canon attributes from sparse character notes.
inputSchema: ./schemas/s1Input.zod.js
outputSchema: ./schemas/s1Output.zod.js
fewshot:
  - ./fewshot/s1.example1.json
  - ./fewshot/s1.example2.json
provider:
  responseFormat: json
  temperature: 0.35
  maxTokens: 1200
tags: [extrapolation, stage1, character]
---

System: Return strict JSON only.

User:
Extract entities and canon attributes from sparse character notes.
Return JSON conforming to the output schema.

Primary entity: {{entity.name}} ({{entity.type}})
Source text:
{{sourceText}}

{{#if fewshot}}
Examples:
{{#each fewshot}}
Input: {{this.input}}
Output: {{this.output}}
{{/each}}
{{/if}}
```

Why frontmatter + markdown over JS templates:
- A/B test by bumping `version:`; old version stays for rollback.
- `npm run prompts:list` enumerates every prompt in the system (single source of truth).
- Per-project overrides become a directory shadow (`prompts/library/_overrides/<projectSlug>/...`).
- Diff is readable in PR review.
- Few-shot exemplars are external JSON files, version-controlled separately from instructions.

Pin the polish prompt (`api/lib/polishCore.js` lines 12–99) as `polish.system.v1.prompt.md` first — it's the highest-craft asset and least likely to regress.

### C3. Structured JSON outputs with repair + retry

Today, stages call the LLM with `responseFormat: 'json'` (`api/lib/extrapolation/stages.js` line 32) but the parsers silently drop malformed items (`api/lib/extrapolation/parsers/s2Parser.js` line 9). Move parsing into the client:

```js
// api/lib/llm/structuredOutput.js
export async function callWithSchema({
  client, promptId, version, variables, schema,
  maxRetries = 1,
  onDrop, // callback for items that fail per-item validation
}) {
  const attempt = async (extraSystem = '') => {
    const text = await client.raw({ ... })
    const json = parseJsonFromLlmText(text)
    return schema.safeParse(json)
  }

  let result = await attempt()
  if (!result.success && maxRetries > 0) {
    // Repair pass: send the error message back to the LLM and ask for a fix.
    result = await attempt(
      `Previous response failed validation: ${result.error.issues.map(i => i.message).join('; ')}.
       Return JSON matching the schema. Do not include any prose.`
    )
  }
  if (!result.success) throw new LlmStructuredError(result.error, text)
  return result.data
}
```

Three concrete wins:
- **No more silent drops.** Per-item validation reports dropped items back to the orchestrator → surfaces as `"3 attributes returned, 1 dropped"` in the UI.
- **One repair attempt** before giving up — cheap, high recovery rate for "extra commas" / "missing field" failures.
- **Caller no longer sees raw strings.** `runExtrapolationStage` receives a typed object.

### C4. Bible layer — schema-driven Character / Location / Era

Make the Bible a first-class object that *projects* from the entity attribute store. Three artifacts:

1. **Per-type Zod schemas** with sections marked `required` / `recommended`:
   ```js
   // api/lib/bibles/schemas/characterBible.schema.js
   export const CharacterBibleSchema = z.object({
     demographics: z.object({
       name: z.string(),
       age: z.number().int().optional(),
       gender: z.string().optional(),
     }).required(),                            // required section
     physical: PhysicalSchema.required(),
     wardrobe: WardrobeSchema.recommended(),
     voice: VoiceSchema.recommended(),
     psychology: PsychologySchema.recommended(),
     history: HistorySchema.recommended(),
     relationships: z.array(RelationshipRef).default([]),
     visuals: z.object({ primaryAnchor: AnchorRef, ...}).required(),
   })
   ```
2. **Projection function** `entity → Bible`:
   ```js
   // api/lib/bibles/projection.js
   export function projectCharacterBible(db, entityId) { ... }
   ```
3. **Completeness function** that returns missing required + recommended fields with severity. This is **gap detection**:
   ```js
   getBibleCompleteness(db, entityId)
   // → { ratio: 0.74, missingRequired: [...], missingRecommended: [...] }
   ```

Gate `mvpDoneGate` on completeness ≥ threshold instead of the current `≥12 canon attributes` heuristic (`api/lib/continuity/mvpDoneGate.js`). UI: a `CompletenessRing` in the Bible Editor, and per-section "missing field" chips.

### C5. Long-term memory — `projects` root + Bible snapshots + scene graph

Three migrations, all small. The `project_id` columns already exist on `characters`, `prompt_packs`, `generated_images` and are documented as reserved (`api/lib/db/schema.js` lines 3, 17, 30, 38) — the migration is to:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT,
  era_entity_id TEXT,                    -- the Era Bible for this production
  active INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT,                     -- arbitrary metadata
  created_at TEXT, updated_at TEXT
);
ALTER TABLE entities ADD COLUMN project_id TEXT;
CREATE INDEX idx_entities_project_id ON entities(project_id);

CREATE TABLE bible_snapshots (
  id TEXT PRIMARY KEY,
  entity_id TEXT, project_id TEXT,
  label TEXT,                            -- "draft", "approved", "act2-fork"
  bible_json TEXT NOT NULL,              -- frozen projection
  parent_snapshot_id TEXT,               -- branching
  created_at TEXT
);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  episode INTEGER, sequence INTEGER, slug TEXT,
  state_json TEXT,                       -- wardrobe state, time, location refs
  prior_scene_id TEXT,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE scene_entities (
  scene_id TEXT, entity_id TEXT, role TEXT,
  PRIMARY KEY (scene_id, entity_id)
);
```

Effects:
- Single project selector in the header → every page filters by active project.
- **Bible snapshots** = versioning + branching ("Draft" vs "Approved", "Act 2 fork"). Cheap immutable JSON; the live entity attrs continue mutating.
- **Scene graph** is the long-form memory: each scene inherits state from `prior_scene_id`. Wardrobe-state-after-jacket-loss propagates forward automatically.
- Continuity QA fixtures move from hardcoded Russian-Perestroika (`api/lib/continuity/continuityQaHarness.js`) onto the project's scenes.

Don't build the full scene UI in V2 — just land the tables and one route to create+list. Scenes can wait; the column has to exist before anything that references it ships.

### C6. Agent/tool surface — MCP-ready from day one

Today there's no clean way to ask "give me Ruslan's Bible" from an external agent (Claude Desktop, Cursor, a custom orchestrator). Add a tool registry that:

```js
// api/lib/agents/toolRegistry.js
export const tools = [
  defineTool({
    name: 'bible.get',
    description: 'Get the projected Bible for an entity.',
    input: z.object({ entityId: z.string() }),
    output: CharacterBibleSchema.or(LocationBibleSchema).or(EraBibleSchema),
    handler: ({ entityId }, ctx) => projectBible(ctx.db, entityId),
  }),
  defineTool({
    name: 'bible.detectGaps',
    description: 'Return missing required/recommended fields.',
    input: z.object({ entityId: z.string() }),
    output: CompletenessSchema,
    handler: ({ entityId }, ctx) => getBibleCompleteness(ctx.db, entityId),
  }),
  defineTool({
    name: 'extrapolation.runStage',
    description: 'Run one extrapolation stage with optional cache salt.',
    input: z.object({ entityId: z.string(), stageId: z.number().int(), salt: z.string().optional() }),
    output: ExtrapolationResultSchema,
    handler: ({ entityId, stageId, salt }, ctx) => runExtrapolationStage({ ... }),
  }),
  defineTool({ name: 'attribute.write', ... }),
  defineTool({ name: 'project.list', ... }),
  defineTool({ name: 'scene.create', ... }),
  defineTool({ name: 'comfy.queueRender', ... }),
]
```

Two adapters:
- `mcpServer.js` — wraps the registry as an MCP server (stdio). External agents (Claude Desktop, custom flows) get every capability via standard MCP.
- `httpAdapter.js` — `POST /api/agents/tools/:name` calls the same handler. Same validation surface, used by future in-app agent prompts.

Properties of this design:
- Every tool has `input` + `output` Zod schemas → adapters automatically validate.
- Tools are the **only** way for the system to call its own capabilities → fewer ad-hoc fetches.
- The same registry powers an eventual "Agent mode" in the UI ("Fill in missing wardrobe fields automatically").
- MCP integration is a thin file, not a refactor.

### C7. SSE for extrapolation progress, not just ComfyUI

`api/lib/extrapolation/orchestrator.js` already exposes `onStageComplete` (line 80). Wrap it in a progress bus and expose `/api/bibles/extrapolate?entityId=...` as SSE so the Bible UI streams per-stage updates. ComfyUI's SSE in `vite.config.js` is the existing pattern; reuse it.

### C8. Vite plugin extraction

`vite.config.js` becomes:

```js
// vite.config.js
import { qpbDevServer } from './api/vite-plugin/index.js'
export default defineConfig({
  plugins: [react(), qpbDevServer({ env: process.env })],
})
```

`api/vite-plugin/index.js` reads `api/routes/_registry.js` (which exports `[{ path, method, handler, allowedModes }]`) and binds them all. Chroma supervisor and Comfy SSE poller become small lifecycle modules.

### C9. Repositories split

`api/lib/db/repositories.js` is 52,066 bytes / >1,800 lines and growing. Split by table family:

```
api/lib/db/repositories/
  index.js           # re-exports
  entities.js
  entityAttributes.js
  entityRelationships.js
  visualAnchors.js
  projects.js
  scenes.js
  characters.js      # legacy
  promptPacks.js
  ...
```

Same function signatures, internal split. Drops parse time, makes the `entityAttributesProvenanceGuard` test still pass with no changes (it scans by regex).

### C10. Telemetry — log every prompt + response

```js
// api/lib/llm/telemetry.js
export function createTelemetry({ env }) {
  if (!env.QPB_LLM_TRACE) return { record: () => {} }
  return {
    record: ({ promptId, version, system, user, response, durationMs, schemaResult }) => {
      fs.appendFileSync('data/llm-traces.jsonl', JSON.stringify({ ts, promptId, ... }) + '\n')
    }
  }
}
```

Reusable in tests as a fake. Solves the "no prompt observability" gap (§4.8 of `comprehensive_review.md`).

---

## D. New Files / Modules to Create

Bold = blocker for V2.

| Path | Purpose |
|---|---|
| **`api/lib/llm/client.js`** | Single `LlmClient` factory; everyone uses it |
| **`api/lib/llm/structuredOutput.js`** | JSON validation + repair + retry |
| `api/lib/llm/telemetry.js` | Optional `data/llm-traces.jsonl` |
| **`api/lib/prompts/registry.js`** | Load `*.prompt.md`, parse frontmatter, version |
| **`api/lib/prompts/render.js`** | Minimal handlebars (no deps; ~50 lines) |
| `api/lib/prompts/library/*.prompt.md` | Migrate existing prompts |
| **`api/lib/bibles/schemas/*.schema.js`** | Character / Location / Era / Prop Bible Zod |
| **`api/lib/bibles/projection.js`** | entity → Bible |
| **`api/lib/bibles/completeness.js`** | Gap detection |
| `api/lib/bibles/approval.js` | Section-level approve/reject |
| **`api/lib/db/migrations/2026-05-add-projects.sql`** | + `projects`, `entities.project_id` |
| `api/lib/db/migrations/2026-05-bible-snapshots.sql` | Versioning |
| `api/lib/db/migrations/2026-06-scenes.sql` | Long-form memory |
| `api/lib/db/repositories/index.js` + split files | Split 52KB file |
| **`api/lib/projects/repository.js`**, `context.js` | Active-project resolver |
| **`api/lib/agents/toolRegistry.js`** | Tool catalog |
| `api/lib/agents/tools/*.tool.js` | Individual tools |
| `api/lib/agents/adapters/mcpServer.js` | MCP exposure |
| `api/lib/agents/adapters/httpAdapter.js` | `/api/agents/tools/:name` |
| `api/lib/agents/executor.js` | Run tool, validate I/O |
| `api/lib/extrapolation/stages/{character,location,era}/` | Type-aware S1–S6 |
| `api/lib/extrapolation/progressBus.js` | SSE event source |
| **`api/routes/_registry.js`** | Replaces 72 inline middlewares |
| `api/routes/bibles/*` | Bible HTTP surface |
| `api/routes/projects/*` | Project HTTP surface |
| `api/routes/agents/tools.js` | `/api/agents/tools/:name` |
| `api/vite-plugin/index.js` | Mount routes registry |
| `src/context/{Project,Engine,PromptState,Toast}Context.jsx` | App-wide state |
| **`src/features/bible/BibleEditor.jsx`** | Replaces flat `EntityEditor` |
| `src/features/bible/CompletenessRing.jsx` | Visual gap indicator |
| `scripts/prompts-list.mjs`, `prompts-diff.mjs` | Prompt devtools |

---

## E. Step-by-Step Refactor Plan

Sequenced by **value × risk**. Each phase is independently shippable; ship in this order. Time estimates assume one focused engineer.

### Phase 0 — Foundations (3–4 days) — *do this first, nothing else moves cleanly until this is in*

1. **`LlmClient` + `structuredOutput`** (1.5 days)
   - Implement `api/lib/llm/client.js` mirroring `runWithResolvedProvider` semantics.
   - Add `callWithSchema()` with one-shot repair retry.
   - Migrate `api/lib/extrapolation/llm.js` to wrap the new client (no behavior change).
   - Remove 4 duplicate `llmGenerate` closures in `vite.config.js`.
2. **Prompt registry, no migration yet** (1 day)
   - Build `registry.js` + `render.js` (Zod parsing of frontmatter, plain `{{var}}` + `{{#each}}` / `{{#if}}` template). No third-party templating dep.
   - Add `prompts:list` script.
3. **Route registry skeleton + extract Chroma + Comfy SSE** (1 day)
   - `api/routes/_registry.js` exports an empty array initially.
   - Create `api/vite-plugin/index.js` that mounts the registry alongside the existing inline middleware. Both can coexist during migration.
   - Move Chroma supervisor and Comfy SSE poller out of `vite.config.js`.

Deliverable: every existing route still works, but new infrastructure exists. Tests pass. `vite.config.js` shrinks ~400 lines.

### Phase 1 — Prompt migration + JSON hardening (2–3 days)

1. Migrate the 6 extrapolation stage prompts + polish system prompt + character-optimize prompt to `*.prompt.md`. Pin them at `v1`.
2. Define output schemas for S1–S6 (the work `api/lib/extrapolation/schemas/` started for S1 — finish it).
3. Switch `stages.js` to `client.chat({ promptId, schema })`. Replace silent drops in `parsers/*.js` with diagnostic results.
4. Surface `stageResult.dropped: [{ key, reason }]` in the orchestrator and propagate to the UI.

Deliverable: every stage call goes through the registry + schema. Dropped attributes are visible. Zero regressions in `extrapolation.test.js`.

### Phase 2 — Bible layer + gap detection (3–5 days)

1. Land `characterBible.schema.js` first. Implement `projection.js` + `completeness.js`.
2. Replace `EntityEditor.jsx`'s string-prefix section hack with schema-driven sections — each section is a sub-schema, and the panel shows required / recommended / present / missing.
3. Add `CompletenessRing` + per-section "missing" chips.
4. Add `LocationBibleSchema` + `EraBibleSchema` (smaller, ~1 day each).
5. Gate `mvpDoneGate` on `completeness.ratio >= 0.75` for the character Bible.

Deliverable: the Bible Editor is product-quality. "Universal Bible builder" moves from talk to ship-able.

### Phase 3 — Project root + Bible snapshots (2 days)

1. Migrations: `projects`, `entities.project_id`, `bible_snapshots`.
2. `ProjectContext` in the frontend, header dropdown.
3. Every entity / character / prompt-pack route filters by `project_id` when provided.
4. "Approve Bible" button → writes a snapshot. Compare two snapshots via diff view (basic — can be JSON diff first).

Deliverable: QPB becomes multi-project. Series production becomes possible.

### Phase 4 — Type-aware extrapolation (2–3 days)

1. `orchestrator.js` dispatches stage handlers on `entity.type`.
2. New location-specific S2 (period fixtures, climate, decay), S3 (atmosphere), S4 (inverted: characters/props that inhabit it), S5 (location visual descriptor — no portrait composition).
3. Era stages: S2 (cultural artifacts, slang, technology), S5 (era-defining visual cues).

Deliverable: Location and Era Bibles get real extrapolation, not just S4 side effects.

### Phase 5 — Agent/tool surface + MCP adapter (2–3 days)

1. `toolRegistry.js` + first 8 tools (`bible.get`, `bible.detectGaps`, `extrapolation.runStage`, `attribute.write`, `project.list/create`, `comfy.queueRender`).
2. `httpAdapter.js` → `/api/agents/tools/:name`.
3. `mcpServer.js` → minimal stdio MCP server. Document for Claude Desktop / Cursor usage.

Deliverable: every important capability is callable from an external agent. In-app "Fill the gaps" button can hit `bible.detectGaps` then loop on `attribute.write`.

### Phase 6 — Route migration + frontend split (3–5 days, parallelizable)

1. Move remaining inline middlewares from `vite.config.js` into `api/routes/*.js` files. Track in a checklist; one PR per ~10 routes.
2. Split `App.jsx` along context boundaries: `AppRoot`, `AppRoutes`, `ShareLinkController`, `WorkspaceProfileSync`, `EngineController`. Lift `useState` into `EngineContext` / `PromptStateContext` / `ProjectContext`.
3. Reorganize `src/components/*` into `src/features/<area>/`. Pure rename; no semantic change.

Deliverable: `vite.config.js` < 300 lines, `App.jsx` < 200 lines, components live in feature folders.

### Phase 7 — Scene graph + continuity beyond Ruslan (3+ days, post-MVP)

Scenes, scene state inheritance, project-specific continuity QA fixtures.

---

## F. Decisions Worth Calling Out

- **No framework swap.** Stay on React + Vite + better-sqlite3 + Zod. Adding a state library (Redux, Zustand) is unnecessary if the context split in Phase 6 is done; React Context is enough for this size.
- **No CommonJS reintroduction.** All new modules stay ESM.
- **Prompts in markdown, not YAML or JSON.** Markdown bodies render readably in PRs; frontmatter handles structured metadata.
- **No external prompt-library dependency** (Promptfoo, Langfuse, etc.) at first. The registry is ~150 lines of code. Add observability tooling later if needed.
- **MCP server in Node directly**, not via a separate language runtime. `@modelcontextprotocol/sdk` exists for Node and is small.
- **Don't kill `polishCore.js`'s polish prompt during migration.** Pin it as `polish.system.v1.prompt.md` byte-for-byte, then iterate as `v2`. The 88 lines of cinematography are the single most carefully-tuned asset in the repo.
- **Don't merge `characters` and `entities` tables.** The legacy table powers a working pipeline (Character Builder → Casting Room → Actor Bank). Migrate gradually via the existing `entity-lift-from-bank` route; deprecate `characters` after the entity-driven pipeline reaches feature parity.
- **Stage cache stays.** Add an optional `salt` parameter (also as a tool input) so the UI can re-roll without invalidating other entities' caches (§4.5 of the prior review).

---

## G. Risk Map

| Change | Risk | Mitigation |
|---|---|---|
| Prompt registry | Behavioral drift if Markdown→string roundtrip introduces whitespace differences | Snapshot test: render each migrated prompt and assert byte-equality with the inline version before deleting it |
| `LlmClient` unification | Subtle differences in fetch/timeout handling across providers | Keep current provider files unchanged; wrap them. Existing `polishCore.test.js` and `lmStudioProvider.test.js` are the safety net |
| Repositories split | Import churn across the codebase | Re-export everything from `repositories/index.js` so existing imports keep working |
| Route extraction | A missed middleware breaks an endpoint silently | One PR per ~10 routes; smoke-test the dev server after each |
| Bible schemas | Existing entities won't pass new schemas | Schemas distinguish `required` vs `recommended`; completeness *measures* rather than rejects. No blocking validation on read paths |
| MCP adapter | External agents could write garbage attributes | Every tool's handler routes through the same `writeAttribute` provenance guard. The guard test stays green |
| Projects migration | Existing data has no `project_id` | Backfill all current rows into a `default` project on migration apply |

---

## H. What Success Looks Like After V2

- `vite.config.js` is `defineConfig({ plugins: [react(), qpbDevServer()] })` — under 300 lines.
- `App.jsx` is a thin shell that mounts contexts and routes — under 200 lines.
- Every prompt in the system is discoverable via `npm run prompts:list`, versioned, and round-trippable.
- Every LLM call uses `LlmClient.chat({ promptId, schema })`. There is no `parseJsonFromLlmText` outside `structuredOutput.js`.
- `bd ready` can pull a "Bible incomplete" issue auto-filed when `completeness.ratio < 0.5`.
- An external agent can pull a Bible, detect gaps, and fill them via `/api/agents/tools/*` — same surface that the in-app "Auto-fill" button uses.
- A series can have multiple projects; each project has its own Era Bible, its own continuity QA fixtures, and its own approved Bible snapshots.
- Stage extrapolation streams progress over SSE. Failed stages show what was dropped and why.

The infrastructure investments in this codebase (provenance, stage caching, lifecycle, Zod boundaries) make this architecture cheap to land. Each phase is independently valuable; you can stop after Phase 3 and already have a categorically different product than today.

---

## I. Phase Cheat-Sheet

| Phase | Days | Unlocks | Stop-here viability |
|---|---|---|---|
| 0. Foundations | 3–4 | LlmClient, prompt registry shell, route plugin | No new UX, but cuts ~400 lines from `vite.config.js` |
| 1. Prompt migration + JSON | 2–3 | Versioned prompts, no silent drops, repair retry | Visible quality improvement in extrapolation |
| 2. Bible layer | 3–5 | Schema-driven Bible Editor, completeness ring | Headline product feature: gap detection ships |
| 3. Project root | 2 | Multi-project, snapshots | Series production becomes possible |
| 4. Type-aware stages | 2–3 | Real Location & Era Bibles | "Universal Bible" promise delivered |
| 5. Agent/tool + MCP | 2–3 | External agents, in-app auto-fill | Future-proofs the platform |
| 6. Route + UI split | 3–5 | Clean dev-server, thin App.jsx | Pure tech debt payoff, no new UX |
| 7. Scene graph | 3+ | Long-form continuity, wardrobe state | Post-MVP, but the column needs to exist by Phase 3 |

**Total core (Phases 0–5):** ~14–21 engineer-days for a categorically different application.
