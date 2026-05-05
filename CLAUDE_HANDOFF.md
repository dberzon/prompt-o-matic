# Claude Code Handoff — Qwen Prompt Builder

This document is for a Claude Code agent starting work on this project. Read it before touching any code.

---

## 1. Current Architecture

**What it is:** A local-first tool for constructing cinematic text-to-image prompts and generating AI actor portraits. Runs entirely on a developer machine — no production server.

**Stack:**
- Frontend: React 18 + Vite, CSS Modules, no UI library
- API: Vite dev-server middleware plugins in `vite.config.js` — no separate Express/Fastify server
- Database: SQLite via `better-sqlite3`
- Vector store: Chroma (auto-spawned on dev start)
- Image generation: ComfyUI (localhost:8188)
- LLM: Ollama or LM Studio (local), Anthropic Claude (cloud fallback)

**Four tabs:** Prompt Builder, Character Builder, Casting Room, Actor Bank. See `AGENT_HANDOFF.md` for full tab descriptions and `APPLICATION_REFERENCE.md` for exhaustive source-verified detail.

**P6 cross-tab wiring (as of May 2026):**
- Actor Bank character slots can be linked to Prompt Builder director scenarios (`bankCharId/bankCharName/bankCharDesc` in each `chars[i]` slot; `DirectorSection.jsx` uses `bankCharDesc ?? getCharDesc(g, a)`).
- `assemblePrompt` receives `effectiveCharacters` = Actor Bank chars (slugified) merged with Character Builder localStorage — `@slug` tokens in scene text resolve against both sources.
- "Open in Casting Room →" in `ActorDetail` sets `activeTab='pipeline'` + `castingRoomJumpId` in App.jsx; `CastingPipelinePanel` receives `jumpToCharacterId` prop and applies it once via `useEffect`.

**API surface:** ~47 routes across 10 domains, all registered in `vite.config.js`.

**Database:** 10 SQLite tables. Schema in `api/lib/db/schema.js`. All query functions in `api/lib/db/repositories.js`.

---

## 2. Key Files

| File | What it does |
|---|---|
| `src/App.jsx` | Root component; all Prompt Builder state; tab switching; blend, presets, profiles; `bankCharsForSelector` fetch + `effectiveCharacters` memo; `castingRoomJumpId` cross-tab bridge state |
| `src/utils/assembler.js` | `rewriteScene`, `assemblePrompt`, `dedupeFragments`, `getCharDesc` |
| `src/utils/slugify.js` | `toSnakeSlug`, `resolveCharacterSlug` — used by `@slug` expansion and Actor Bank character linking |
| `api/lib/polishCore.js` | System prompt, provider resolution, `runPolish`, `healthCheck` |
| `vite.config.js` | All API route handlers; Chroma auto-spawn; SSE watcher |
| `api/lib/db/schema.js` | All CREATE TABLE SQL + MIGRATIONS array |
| `api/lib/db/repositories.js` | All DB query functions; `listCharacters` and `getCharacter` both SELECT `archived_at` alongside `payload_json` and merge it into the returned object |
| `src/components/CastingPipelinePanel.jsx` | Entire Casting Room — Path A + B + Active Character + render system; accepts `jumpToCharacterId`/`onJumpConsumed` props for cross-tab navigation |
| `src/components/ActorBank/ActorBankView.jsx` | Actor Bank tab root; archived toggle; passes `onOpenInCastingRoom` to ActorDetail |
| `src/components/ActorBank/ActorCard.jsx` | Character card with lifecycle badge, image count, archived state |
| `src/components/ActorBank/ActorBankFilters.jsx` | Filter bar with search, gender chips, age range, sort select |
| `src/components/ActorBank/ActorDetail.jsx` | Character detail — inline rename, archive/restore, image keep/discard, portfolio re-queue, "Open in Casting Room" |
| `src/components/DirectorSection.jsx` | Director + character slot UI; `bankChars` prop enables "link actor…" per slot |
| `src/components/CharacterBuilder.jsx` | Character bank entry form and management |
| `api/lib/characterLifecycle.js` | Character lifecycle state machine |
| `api/lib/characters/batchGeneration.js` | Batch generation + similarity classification |
| `api/lib/characters/batchReview.js` | Batch review actions including Save to Cast |
| `api/lib/audition/auditionOrchestrator.js` | Path A full orchestration |
| `src/data/directors.js` | 61 directors with scenarios |
| `src/data/constants.js` | REWRITES (29), DEFAULTS, DIRECTOR_PRESETS (61) |

---

## 3. Safe Modification Zones

These areas can be changed with low risk:

- `src/components/` — UI components (PromptOutput, ChipSection, DirectorSection, SceneMatcher, SceneInput, ActorBank/*, etc.)
- `src/utils/assembler.js` — prompt assembly and scene rewriting (small changes: adding REWRITES, tweaking fragment order)
- `src/utils/qualityScore.js`, `src/utils/promptRules.js`, `src/utils/variants.js` — scoring and rule logic
- `src/data/directors.js` — adding/editing directors (follow existing pattern)
- `src/data/constants.js` — adding chip presets, FEATURED_PRESETS
- `src/hooks/` — frontend request hooks
- `docs/` — documentation
- Tests (`*.test.js` files) — add coverage freely

---

## 4. Dangerous Zones (Requires Care)

Changes here can break the whole application or corrupt data:

**`vite.config.js`** — All 47+ API route handlers live here. Adding a route is safe; changing an existing route's request/response contract can break all callers. Be surgical. Test with `npm test` and `npm run build` after changes.

**`api/lib/db/schema.js` and `api/lib/db/repositories.js`** — Database schema and all query functions. Changing column names or table structure without adding a migration will corrupt the DB. Always add backward-compatible migrations to the `MIGRATIONS` array, not by editing `CREATE_TABLES_SQL`. Never drop columns.

Note: `archived_at` is a separate DB column, NOT stored inside `payload_json`. `listCharacters` and `getCharacter` both explicitly SELECT it and merge it into the returned object. Any new query function that needs `archived_at` must do the same — do not assume it comes from `rowToPayload`.

**`api/lib/polishCore.js` and `api/lib/llm/providers/`** — LLM provider resolution, system prompt, and provider clients. Changes here affect all polish behavior. The provider resolution chain is: embedded → local (Ollama/LM Studio) → cloud. Do not alter the fallback logic without understanding the full chain.

**`api/lib/characterLifecycle.js`** — The lifecycle state machine for characters (`auditioned` → `portfolio_pending` → `portfolio_failed`/`ready`). Incorrect transitions leave characters in broken states that require manual DB fixes.

**`api/lib/audition/auditionOrchestrator.js` and `api/lib/characters/batchGeneration.js`** — Path A and Path B orchestration. These create database records and queue ComfyUI jobs atomically. Partial failures have cleanup logic — do not rewrite.

---

## 5. Working Rules

- Run `npm test` after any non-trivial change.
- Run `npm run build` to confirm no build errors before committing.
- Prefer surgical patches — change only what is needed.
- Do not change the `/api/polish` or `/api/polish-health` contract without explicit instruction; many frontend paths depend on their exact response shape.
- Do not add new SQLite columns without adding a migration entry in `api/lib/db/schema.js`'s `MIGRATIONS` array.
- Director count is **61**. Do not write 60 or 25.
- The `APP_MODE=local-studio` is the operative mode. Cloud mode is for a hypothetical Vercel deployment; do not assume cloud mode works for any feature beyond polish.
- Use `bd` for task tracking, not TodoWrite or markdown TODO lists.
- `assemblePrompt` receives `effectiveCharacters` (Actor Bank chars merged with localStorage chars), not `characters` directly. Do not replace this with `characters` alone — it would break Actor Bank `@slug` expansion.
- The `chars[i]` shape is `{ g, a }` OR `{ g, a, bankCharId, bankCharName, bankCharDesc }`. The `bankCharDesc` field bypasses `getCharDesc` in `DirectorSection`. Do not strip unknown fields when updating a char slot — use spread (`{ ...prev, [field]: value }`).

---

## 6. Before Starting Work

1. Run `bd prime` to see the current beads issue queue.
2. Run `npm test` to confirm the test suite is green.
3. Read `APPLICATION_REFERENCE.md` for any subsystem you are about to touch — it was written directly from the source code and is the authoritative reference.
4. If changing the database: find the `MIGRATIONS` array in `api/lib/db/schema.js` and add your migration there.
5. If changing an API route: find its handler in `vite.config.js` and check all callers in `src/lib/api/` and `src/api/`.

---

## 7. Test and Build

```bash
npm test          # Vitest unit tests
npm run build     # Vite production build (confirm no errors)
npm run dev       # Start dev server (frontend + all API routes on localhost:5173)
```

Tests cover: `assembler`, `slugify`, `usePolish`, `polishCore`, `db`. Run all before committing.
