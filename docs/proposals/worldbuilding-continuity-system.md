# Worldbuilding & Continuity Intelligence System

**Status:** Proposal (historical sketch; implementation has diverged — see note in §5.2)

**Implementation note (2026):** The shipped schema adds `location` and `era` to `entities.type`, adds `archived_at`, uses TEXT timestamps in several places, and implements type-aware extrapolation (`api/lib/extrapolation/stageRegistry.js`). Treat the SQL below as conceptual unless reconciled with `api/lib/db/schema.js`.

**Target:** CastingRoom / Prompt-O-Matic
**Scope:** Net-new semantic layer above existing prompt assembly

---

## 1. Problem

CastingRoom currently generates prompts for individual outputs. It does not persist the entities those prompts describe, does not preserve identity across generations, and cannot extrapolate from sparse user notes. Producing a 10-shot scene with a recurring character today requires re-specifying identity in every prompt; visual drift is the norm.

## 2. Goal

Add a persistent entity layer that:

1. Stores characters, environments, props, and relationships as first-class records.
2. Extrapolates plausible detail from sparse input via staged LLM inference.
3. Tracks provenance of every attribute (user-authored vs AI-inferred) so canon never silently drifts.
4. Emits prompt-packs and visual anchors that the existing ComfyUI pipeline consumes without modification.

## 3. Non-Goals (MVP)

Explicitly out of scope for v1:

- Video generation
- Multi-user collaboration / sharing
- Per-character LoRA training (deferred to P2)
- Graph database backend (relationships are FK rows in SQLite for v1)
- Cloud inference routing (local-first, consistent with current direction)
- Full historical fact-checking (low-confidence flag is acceptable for v1)
- Auto-generated locations independent of characters (locations derive from character context in v1)

## 4. MVP Definition

A user can:

1. Paste 2–10 sentences describing a character.
2. Run the extrapolation pipeline.
3. Review and approve / reject / edit each inferred attribute.
4. Generate a prompt-pack consumable by the existing ComfyUI workflow.
5. Re-run generation later and get visually consistent output (face structure, body, wardrobe logic, age).

**Done =** one character + one environment context, full pipeline, identity holds across 5 generations with different scene prompts (face/body/wardrobe match scored ≥4/5 by reviewer).

---

## 5. Architecture

### 5.1 Layers

The original six layers collapse to three for MVP:

| Layer | Responsibility | MVP scope |
|---|---|---|
| Entity | Persistence + provenance | Full |
| Extrapolation | Staged LLM inference | 6 stages (collapsed from 8) |
| Continuity | Visual anchor management | IPAdapter strategy only; LoRA deferred |

The Relationship Graph and Environment systems fold into Entity for v1 (relationships = FK rows; environments = entities of `type='environment'`).

### 5.2 Data Model

The `provenance` field is load-bearing. Any code path that writes to `entity_attributes` without setting it is a bug.

```sql
CREATE TABLE entities (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK(type IN ('character','environment','prop','institution','location','era')),
  name          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE entity_attributes (
  id            TEXT PRIMARY KEY,
  entity_id     TEXT NOT NULL REFERENCES entities(id),
  key           TEXT NOT NULL,
  value         TEXT NOT NULL,
  provenance    TEXT NOT NULL CHECK(provenance IN ('canon','inferred','suggested','temporary','derived')),
  confidence    REAL,                                       -- 0.0–1.0, NULL for canon
  source_stage  INTEGER,                                    -- pipeline stage that produced this, NULL for canon
  superseded_by TEXT REFERENCES entity_attributes(id),      -- previous row when edited
  created_at    INTEGER NOT NULL
);

CREATE TABLE entity_relationships (
  id            TEXT PRIMARY KEY,
  from_id       TEXT NOT NULL REFERENCES entities(id),
  to_id         TEXT NOT NULL REFERENCES entities(id),
  type          TEXT NOT NULL,                              -- 'family.mother', 'romantic.crush', 'social.friend'
  provenance    TEXT NOT NULL CHECK(provenance IN ('canon','inferred','suggested','derived')),
  confidence    REAL,
  attributes    TEXT                                        -- JSON for relationship-specific fields
);

CREATE TABLE visual_anchors (
  id            TEXT PRIMARY KEY,
  entity_id     TEXT NOT NULL REFERENCES entities(id),
  type          TEXT NOT NULL CHECK(type IN ('reference_image','ipadapter_embedding','seed','prompt_anchor')),
  payload       BLOB,                                       -- image bytes, embedding vector, or text
  is_primary    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
```

ChromaDB is used in parallel for semantic similarity search over `entity_attributes.value` (find characters with similar wardrobe, locations with similar atmosphere). It is **not** the source of truth.

### 5.3 Provenance Semantics

| Provenance | Editable by user | Survives re-extrapolation | Used in prompt assembly |
|---|---|---|---|
| `canon` | Yes (creates new canon row) | Yes | Always |
| `inferred` | Yes (promotes to canon) | Overwritten unless edited | Yes, marked as soft |
| `suggested` | Promote / dismiss only | Dropped on dismiss | Only if promoted |
| `temporary` | No (scene-bound) | N/A | Only in scope scene |
| `derived` | No (recomputed) | Recomputed | Yes |

Editing an inferred attribute promotes it to canon and writes a new row with `superseded_by` pointing to the original. History is preserved.

---

## 6. Extrapolation Pipeline

Six stages (the original Stage 7 "continuity locking" folds into Stage 5; Stage 8 "prompt-pack compilation" is deterministic and not an LLM stage):

| # | Stage | Purpose | LLM calls per character |
|---|---|---|---|
| 1 | Entity extraction | Parse sparse input → entities + canon attributes | 1 |
| 2 | Historical/cultural enrichment | Era-specific detail (clothing, objects, slang) | 1 |
| 3 | Psychological inference | Behavior, speech, insecurities | 1 |
| 4 | Environmental projection | Likely spaces character inhabits | 1 |
| 5 | Visual descriptor + anchor | Image-gen-ready descriptors + primary anchor | 1 |
| 6 | Cross-stage consistency check | Flag conflicts between stages | 1 |

Each stage reads all prior stages' outputs. Stage 6 is critical: extrapolation drift between stages is the single most likely failure mode and needs explicit detection.

### 6.1 Inference Budget

Per character creation pass (no relationships): **~6 LLM calls**.
Per character + 1 environment + 2 relationship targets: **~18 calls**.

On M4 Pro local inference (Qwen2.5 / Llama 3.x via Ollama), this is roughly 2–4 minutes per pass. Acceptable for an interactive review-driven flow; not acceptable for batch.

Mitigations:

- Hash `(input + stage + model)` → cache result. Re-running with unchanged canon is free.
- Stages 2–5 are independent given Stage 1 output; run in parallel.
- Stage 6 runs only after 2–5 complete.

---

## 7. Visual Continuity Strategy

Three options considered. **MVP commits to (a)**, with (b) as a P2 enhancement.

| Option | Fidelity | Cost | Time-to-ship |
|---|---|---|---|
| (a) IPAdapter + reference image | ~70–80% face/body match across poses | Per-generation only | Days (works in current ComfyUI stack) |
| (b) Per-character LoRA | 90%+ | Hours of training per character + storage | Weeks |
| (c) Fixed seed + locked prompt | ~40–50%, brittle | Free | Hours |

The ComfyUI workflow already supports IPAdapter; the new work is producing and storing the reference image, then injecting it at generation time. Identity is good enough for indie cinematic work and matches the project's existing Tarkovsky/Jarmusch aesthetic register, where slight variation reads as natural film artifact rather than CGI sameness.

(b) is a real upgrade for hero characters but adds a training pipeline, GPU scheduling, and storage management. Defer until MVP validates the broader system.

---

## 8. User Interaction Flow

```
[User input: sparse notes]
        ↓
[Stage 1: Entity extraction]
        ↓
[Review canon: approve / edit / reject extracted entities]
        ↓
[Stages 2–5 run in parallel]
        ↓
[Review inferred attributes: per attribute → keep as inferred / promote to canon / edit / reject]
        ↓
[Stage 6: consistency check, surface conflicts for resolution]
        ↓
[Visual anchor selection: generate or upload reference image]
        ↓
[Prompt-pack compiled, sent to ComfyUI]
        ↓
[Generated outputs linked to entity_id, available as further reference]
```

The frontend extension is fundamentally a **review-and-approval interface**, not a form. Users do not type into 80 fields; they approve, edit, or reject what the pipeline proposes. Three new primary screens: entity editor, attribute review panel, visual anchor picker.

---

## 9. Risks & Unknowns

| Risk | Likelihood | Mitigation |
|---|---|---|
| Extrapolation drift between stages | High | Stage 6 explicit consistency check; flag conflicts for user resolution |
| Provenance bypass in code | High | DB-level NOT NULL + CHECK; single attribute-write helper, no direct INSERT in app code |
| Visual identity below threshold with IPAdapter alone | Medium | Validate on Ruslan-style test character before committing; LoRA fallback path scoped but not built |
| LLM hallucinates plausible-but-wrong historical detail | Medium | Mark Stage 2 outputs as low confidence by default; user review is the fact-check |
| Inference cost balloons with deep relationship graphs | Medium | Cap relationship traversal depth at 1 in v1; expose as explicit setting |
| Schema migration when relationships outgrow FK model | Low | Acceptable; SQLite migrations are manageable at this scale |
| Local model quality insufficient for Stage 3 (psychological) | Medium | Per-stage model selection in config; allow stage-specific model routing |

---

## 10. Prior Art

- **World Anvil, Campfire, Sudowrite Story Bible** — worldbuilding tools without AI extrapolation; inform entity editor UX
- **IPAdapter, InstantID, PuLID** — visual continuity techniques; IPAdapter chosen for MVP for ComfyUI compatibility
- **LoRA / DreamBooth fine-tuning** — higher-fidelity visual continuity at higher cost; deferred
- **Character.AI persona persistence** — persistence without production pipeline; not directly applicable but informs review-flow design

---

## 11. Migration

Existing CastingRoom data is unaffected. The entity layer is additive: existing prompt-assembly endpoints continue to work; new endpoints (`/entities/*`, `/extrapolate/*`, `/promptpack/from-entity/*`) sit alongside. No backfill required.

---

## 12. Open Questions

These need decisions **before** Beads issue creation:

1. Which local model serves which pipeline stage — single model, or per-stage routing?
2. Reference image source for IPAdapter in v1 — generated by ComfyUI from Stage 5 descriptors, or user-uploaded?
3. ChromaDB collection structure — one collection, or per-entity-type collections?
4. How are relationship attributes (e.g., "in love with Rita") differentiated from character attributes during prompt assembly?
5. Smallest test scene that proves continuity works — proposed: same character, 5 different environments, reviewer scores face/body/wardrobe match on 1–5 scale, threshold ≥4 for MVP acceptance.

---

## 13. Worked Example

Input:

> Ruslan Levashov, male, 20–25, short, heavy-built, wide shoulders, slight belly, rounded childish face, piggy eyes, short upturned nose, thin lips, freckles. Lives with his mother and disabled sister in a communal apartment on the outskirts of Moscow during Perestroika. Studies mechanical engineering in technical college. Smokes with friends during breaks. Drinks in Soviet beer halls. In love with Rita Vlasova from pedagogical college.

After pipeline:

- **1 entity of type `character`** (Ruslan), with ~12 canon attributes from Stage 1
- **3 entities of type `character`** (mother, sister, Rita), each minimal canon, awaiting separate enrichment
- **2 entities of type `environment`** (communal apartment, beer hall), inferred
- **1 entity of type `institution`** (technical college), inferred
- **~25 inferred attributes on Ruslan** (cigarette brand, jacket type, posture, speech register, recurring objects, etc.) presented for review
- **1 visual anchor** (reference image) generated from Stage 5 descriptors and ready for IPAdapter injection

Total inference: ~18 calls, ~3 minutes on M4 Pro. User review time: ~5–10 minutes. Subsequent generations of Ruslan in new scenes: ~30 seconds, no LLM calls (anchor + canon attributes only).
