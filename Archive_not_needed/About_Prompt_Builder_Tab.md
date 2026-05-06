# About the Prompt Builder Tab

## What It Is

The Prompt Builder tab is the core feature of the application. Its job is to take a small set of structured user inputs — a scene description, a director style, character information, and a handful of visual chips — and turn them into a production-ready, cinematically coherent text-to-image prompt for Qwen image generation.

The philosophy behind it is simple but specific: good image generation prompts are not mood descriptions. They are material specifications — the kind of instructions a cinematographer would give a camera operator. The tab is built entirely around that idea. Everything in it is designed to push the user away from vague language ("dark, dramatic, moody") and toward precise, grounded language ("flat overcast light, uniform gray sky, no cast shadows; shot on 35mm film, grain visible in flat areas").

---

## The Conceptual Model

### Prompt as Ordered Fragment Stack

The assembled prompt is not a sentence — it is an ordered sequence of fragments, each covering a distinct visual dimension. The order matches how a cinematographer thinks:

```
shot scale → optics → subject/scenario → scene content →
environment → texture → composition → light → color → film stock → quality anchors
```

This ordering is intentional and fixed. Shot scale before content because the frame defines the space before anything fills it. Light before color because color temperature depends on light. Film stock last because it's a post-production decision layered over everything else.

The fragments are joined with commas in the final output — not sentences, not paragraphs. This matches how text-to-image models parse input: as independent semantic tokens rather than narrative prose.

### Director Style as Aesthetic Vocabulary

61 filmmakers are encoded in the system, each with hand-crafted chip presets and scenario libraries. Selecting a director does two things:

1. **Loads their visual signature as chips** — their characteristic shot types, lighting approach, color palette, and film aesthetic. Tarkovsky: extreme wide, fog-filtered light, muted desaturated, 35mm grain. Fincher: tight framing, precise artificial light, cool blue-gray, Alexa digital.

2. **Unlocks their scenario library** — a pool of 3–4 scenarios per character count (1, 2, or 3 characters), written in that director's register. These are not generic descriptions; they encode specific compositional habits. A Tarkovsky 1-character scenario might be: *"figure small against an open sky, back to camera, not moving."* A Lynch 2-character scenario might describe proximity and hierarchy without ever naming an emotion.

Directors are the primary way the system encodes taste. The user doesn't need to know what "Tarkovsky-ish" means in technical terms — they just select it, and the chip preset and scenarios carry the meaning.

### Characters as Pronoun Resolution

Characters are not decorative. They are substitution variables in scenario templates. When a director scenario reads `${c[0]}`, the system replaces it with a natural-language age/gender descriptor derived from the user's character settings:

- Man, 40s → `"man in his early forties"`
- Woman, teen → `"teenage girl"`
- Person, child → `"child"`

This means character count and demographics directly change the available scenarios and their rendered text. Choosing 2 characters opens a different scenario pool (relationship, distance, two-figure composition) than choosing 1 or 3. The casting choices ripple into the prompt content automatically.

### Chips as Technical Vocabulary

Chips are the technical layer. Each chip is a short, precise phrase representing a single visual decision. They're grouped into 9 dimensions:

| Dimension | Example chips |
|-----------|--------------|
| Shot scale | `extreme wide shot`, `close-up — face fills frame` |
| Lens | `35mm natural lens`, `28mm slightly wide lens` |
| Environment | `flooded concrete ruins, shallow standing water` |
| Texture | `heavy fog, middle distance dissolved to pale silhouette` |
| Composition | `figures at left third of frame, large negative space right` |
| Light | `flat overcast light, uniform gray sky, no cast shadows` |
| Color | `muted desaturated palette, faded olive and slate gray` |
| Film stock | `shot on 35mm film, grain visible in flat areas` |
| Quality | `photorealistic, not CGI, not illustrated` |

The user can toggle chips individually, load a director preset (which populates all dimensions at once), or use featured presets for named visual styles.

### AI Polish as Optional Refinement

After the rule-based assembler builds the fragment stack, the user can optionally send it to an LLM for prose refinement. The AI does not invent content — it has a strict system prompt instructing it to preserve material specificity, write 60–110 words, enforce one light source, avoid mood language, and stay in the cinematographic register. It turns a comma list into a tighter, more grammatically coherent prompt without losing precision.

Polish is multi-provider: it can use a local Ollama instance, LM Studio, an embedded Qwen sidecar (in the Tauri desktop build), or Claude via API. If none are available, the assembled prompt is used as-is — the polish layer is enhancement, not a dependency.

---

## The Technical Architecture

### State: All in App.jsx

All Prompt Builder state lives in the root `App.jsx` component. There is no separate state store. This is intentional — it allows undo/redo, URL sharing, and workspace profiles to operate across the full Prompt Builder state without any synchronization overhead. (URL sharing encodes Prompt Builder state only — the Casting Room has its own separate state.)

Key state variables:

```js
scene           // Free-text scene description (string)
selectedDir     // Active director key (string | null)
charCount       // Number of characters: 1, 2, or 3
chars           // [{ g: 'man'|'woman'|'person', a: '20s'|'30s'|... }, ...]
scenario        // Full selected scenario text (string | null)
chips           // { shot: [], lens: [], env: [], light: [], color: [], film: [], qual: [] }
blendEnabled    // Whether director blending is active
blendDir        // Second director for blending
blendWeight     // 0–100 weighting between primary and blend director
```

Persistence: most state is written to `localStorage` on change and restored on mount. Profile saves (full workspace snapshots) are also in `localStorage`.

### Assembly: assembler.js

The assembled prompt is a `useMemo` derived value computed synchronously from `[scene, scenario, chips, characters]`. The assembler (`src/utils/assembler.js`) runs three operations:

**1. Scene rewriting** — `rewriteScene(raw, characters)`

The raw scene text is passed through a table of regexp rewrites (`REWRITES` in constants.js) that expand generic terms into material language. Examples:

- `eastern european village` → `eastern European village outskirts, low rendered-brick houses, corrugated metal fences, overgrown garden plots`
- `forest` → `stand of bare deciduous trees, pale trunks`
- `walking` → `walking at unhurried pace, no apparent destination`
- `suit` → `dark suit, not recently pressed`

These rewrites encode domain knowledge about what makes a scene description useful for image generation. The user can write casually; the system materializes it.

**2. Priority ordering** — `assemblePrompt({ scene, scenario, chips, characters })`

The fragments are collected in fixed priority order:

```
shot → lens → scenario → scene (rewritten) → env → texture →
comp → light → color → film → qual
```

If a dimension has no user chip and no default is needed (because the prompt has no substantive content), it is omitted. Defaults fill in missing light, color, film, and quality anchors when the prompt has substance.

**3. Deduplication** — `dedupeFragments(parts)`

Near-duplicates are removed using two conditions: Jaccard similarity on token sets (threshold ≥ 0.9), and an overlap-to-smaller ratio (threshold ≥ 0.8 — "what fraction of the smaller fragment's tokens appear in the larger"). The second condition is what catches the canonical example: `flat light, no shadows` vs `flat overcast light, no cast shadows` — all 4 tokens of the shorter are present in the longer, giving overlap = 4/4 = 1.0, well above the threshold. The shorter fragment (≥ 24 chars) literal-substring check is a fast path for identical contained phrases.

### Director Data: directors.js

Each of the 61 directors is an object with:

```js
{
  name: 'Andrei Tarkovsky',
  short: 'Tarkovsky',
  note: 'Figures as objects in space. Silence is the subject...',
  s: {
    1: (c) => [`scenario text ${c[0]}`, 'alternate scenario', ...],
    2: (c) => [`two-figure scenario ${c[0]} and ${c[1]}`, ...],
    3: (c) => [`group scenario with ${c[0]}, ${c[1]}, ${c[2]}`, ...],
  }
}
```

`c` is an array of character descriptors resolved at runtime from the `chars` state. The scenarios are functions (not static strings) because they need to embed character descriptions.

### Director Presets: constants.js

Each director also has a corresponding chip preset in `DIRECTOR_PRESETS` (`src/data/constants.js`), hand-crafted to encode their visual signature. These are completely separate from the scenario library — the preset loads visual chips; the scenarios load subject content. Users can use one without the other.

### SceneMatcher: src/components/SceneMatcher.jsx

SceneMatcher is a fuzzy search component that lets the user search the scene bank by keyword and apply a matching result directly to the chip state. When a result is applied, the system fires `beginApplyDiff` before the chip change, captures the new state after, and shows a transient diff panel so the user can see exactly what changed. The component surfaces example queries (via a static `EXAMPLES` list) and opens in a card-style overlay with a text input, results list, and per-result apply button. It is one of three ways to load chips (alongside manual toggle and director preset loading) and the only search-driven one.

### Validation: promptRules.js

The rules system (`src/utils/promptRules.js`) detects coherence conflicts and surfaces them as dismissable warnings in the UI. Rules enforced:

- **Light discipline**: More than one light chip is flagged — single-source light is a core requirement for coherent output.
- **Color palette polarity**: Conflicting color families (e.g., `teal + amber` vs `near-monochrome`) are detected.
- **Film aesthetic**: Mixing analog and digital film aesthetics is flagged.
- **Location conflict**: Mutually exclusive environment chips are caught.

Each violation exposes an auto-fix action (e.g., "Keep first light source") that calls back into App.jsx to correct the chip state.

### Quality Scoring: qualityScore.js

The quality score (`src/utils/qualityScore.js`) is a heuristic 0–100 metric shown live in the prompt output panel:

| Component | Max | Signal |
|-----------|-----|--------|
| Prompt density | 25 | Word count — 55+ words = full score |
| Subject + scene | 15 | Scenario present (+10), scene text present (+5) |
| Anti-CGI anchors | 20 | "photorealistic", "not CGI", "film grain" etc. |
| Film stock language | 15 | Named stock — "Kodak", "Tri-X", "Vision3" etc. |
| Light discipline | 15 | Exactly 1 light chip = full score |
| Material specificity | 10 | Concrete, rust, mud, plaster, water, etc. |

This score is displayed alongside the prompt as a live indicator. It does not gate any action — it is purely informational.

### Variant Generation: variants.js

Three auto-generated variant prompts are derived from the assembled base (`src/utils/variants.js`):

- **Composition focus**: Appends framing language (rule-of-thirds positioning, negative space)
- **Texture + light focus**: Appends wet surfaces, reflections, single practical lamp
- **Color + film focus**: Appends Kodak Vision3 stock language, cool blue-gray, rich shadows

Variants are selectable in the prompt output panel and override the displayed text without affecting chip state.

### Polish: usePolish → /api/polish → polishCore.js

The polish system is a three-layer call chain:

**Frontend hook** (`src/hooks/usePolish.js`) — manages async state (`idle → loading → polished | error`) and fires `POST /api/polish` with the assembled fragments plus context (director name, director note, scene, scenario, narrative beat, engine config).

**Backend handler** (`api/polish.js`) — thin route wrapper, delegates immediately to `runPolish`.

**Core logic** (`api/lib/polishCore.js`) — contains the system prompt (a detailed instruction set covering output length, material specificity rules, one-light discipline, director registers for 15 named directors plus an explicit fallback clause — "For directors not listed above, apply the general aesthetic signature provided by the user" — so unlisted directors are handled via the `directorNote` field passed in every polish request) and the provider resolution chain:

```
embeddedPort set? → use Tauri sidecar
localProvider set? → use Ollama or LM Studio
else → use cloud (Claude API)
```

The system prompt instructs the LLM explicitly: do not invent new content, stay in cinematographic register, 60–110 words, passive figures, no mood language, one light source. The LLM's role is editorial compression, not creative generation.

### Prompt Output: PromptOutput.jsx

The right panel of the Prompt Builder tab (`src/components/PromptOutput.jsx`) is the main display surface. Its display priority, from highest to lowest:

```
1. Manual edit (user typed into the textarea)
2. Restored text (from history or saved prompts)
3. Selected variant
4. AI-polished output
5. Assembled prompt (default)
```

A manual edit does not sync back to chip state — the flow is one-way (chips → assembled → [polish] → display). The user can edit the output freely and reset back to the assembled version at any time.

The panel also contains: copy/download/share, prompt history (12 most recent), saved prompts (up to 30), quality score breakdown, validation warnings with fix buttons, variants switcher, and the AI polish trigger with provider health indicator.

---

## Data Flow

```
User selects: director, charCount, chips, scene, scenario
         │
         ▼
   App.jsx state
         │
         ▼
   assemblePrompt()   ←── assembler.js
   ├─ rewriteScene()        (regexp expand scene text)
   ├─ ordered collect()     (shot → lens → ... → qual)
   └─ dedupeFragments()     (Jaccard similarity filter)
         │
         ▼
   prompt: string[]         (10–15 fragments)
         │
         ├──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
   validatePromptRules()                 generatePromptVariants()
   (light, color, film, env conflicts)   (composition, texture, color variants)
         │                                          │
         ▼                                          ▼
   PromptOutput: display assembled text + quality score + variants
         │
         │  [user clicks "Polish with AI"]
         ▼
   POST /api/polish
   { fragments, directorName, directorNote, scene, scenario, engine, ... }
         │
         ▼
   polishCore.runPolish()
   ├─ buildUserMessage()
   ├─ resolveProvider()  (embedded → local → cloud)
   └─ call LLM
         │
         ▼
   { polished: string, provider: string }
         │
         ▼
   PromptOutput: display polished text
```

---

## Key Files Reference

| File | Role |
|------|------|
| `src/App.jsx` | Master state container, all control handlers, tab routing |
| `src/utils/assembler.js` | Prompt assembly: rewrite, order, deduplicate |
| `src/utils/variants.js` | Auto-generate three prompt variants |
| `src/utils/qualityScore.js` | Heuristic 0–100 quality metric |
| `src/utils/promptRules.js` | Coherence conflict detection and auto-fix |
| `src/data/constants.js` | REWRITES, DEFAULTS, FEATURED_PRESETS, DIRECTOR_PRESETS (61 directors) |
| `src/data/directors.js` | DIRECTORS: 61 directors × 3 char counts × 3–4 scenarios each |
| `src/data/chips.js` | CHIP_GROUPS structure (9 dimensions, ~100 chips) + NEGATIVE_PROMPT |
| `src/components/PromptOutput.jsx` | Display, edit, polish, copy, history, quality panel |
| `src/hooks/usePolish.js` | Frontend async hook for polish API call |
| `api/polish.js` | POST /api/polish route handler |
| `api/lib/polishCore.js` | LLM system prompt, user message builder, provider resolution |
| `api/lib/llm/providers/` | claudeProvider, ollamaProvider, lmStudioProvider, embedded, mock |

---

## Design Decisions Worth Noting

**Synchronous assembly** — The core assembler is deterministic and runs on every state change via `useMemo`. No async, no server call, no loading state for the base prompt. Polish is the only async step, and it is explicitly opt-in.

**One-way prompt flow** — Chips → assembled prompt → (optional) polished. The user can edit the final output, but edits don't propagate back to chip state. This avoids the round-trip complexity of trying to infer chip state from free text.

**Director blending** — Two directors can be blended with a 0–100 weight slider. The blended chip set is computed by interleaving chips from both presets weighted by the slider. This lets users explore hybrid aesthetics without creating custom directors.

**Apply diff tracking** — Whenever the user loads a preset, applies a scenario deck suggestion, or runs the scene matcher, the system captures the before/after chip state and shows a transient diff panel. This gives the user visibility into what changed without requiring manual comparison.

**Material language, not mood language** — The REWRITES table, the director scenarios, the chip vocabulary, and the LLM system prompt are all oriented toward a single goal: eliminating vague mood descriptions ("dark, dramatic, tense") in favor of precise material ones ("flat overcast light, uniform gray sky, no cast shadows"). This is the core product thesis, encoded at every layer.
