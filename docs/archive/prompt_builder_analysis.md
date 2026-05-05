# Prompt Builder Tab — Analysis & Improvement Suggestions
*Against: About the Prompt Builder Tab documentation*
*Cross-referenced with: Casting Room v2, AGENT_HANDOFF.md, FULL_GUIDE.md*

---

## What's Working Well

The conceptual model is coherent and the philosophy is well-implemented
throughout. The fragment-stack ordering, the REWRITES table approach, and the
one-way prompt flow are all sound decisions. The quality score and validation
rules are good additions. The overall architecture — deterministic synchronous
assembler plus optional async polish — is the right shape for this kind of tool.

The issues below are specific and fixable. None require rethinking the product.

---

## DIRECT CONTRADICTIONS

---

### 1. Director count: 25 (AGENT_HANDOFF.md) vs 60 (this document)

AGENT_HANDOFF.md states: "Contains 25 film directors."
This document states: "60 filmmakers are encoded in the system."

One of these is wrong, or the director count grew between documents. Verify
against the actual `src/data/directors.js` using Serena and update whichever
document is stale.

---

### 2. Polish system prompt covers 15 directors — system has 60

The polish core contains "director registers for 15 named directors" in its
system prompt. If the system has 60 directors (or even 25), the LLM receives
no specific register guidance for the majority of them.

A user who selects any of the unlisted directors and runs polish will get
output that is not calibrated to that director's visual register. The assembled
prompt knows the director fully — the polish step partially forgets them.

The `directorNote` field is already passed to the API (visible in the frontend
hook parameters). Confirm in `polishCore.js` `buildUserMessage()` whether this
note is being injected into the LLM context. If it is, the 15-director
hardcoded register list is redundant and may conflict with the dynamic note.
If it isn't, the note is being discarded and the fix is to use it.

---

## LOGIC ERRORS

---

### 3. Deduplication example in the document is likely incorrect

The document describes the deduplication algorithm:
"If two fragments share ≥ 90% of their tokens, or if the shorter fragment
(≥ 24 chars) is a substring of the longer one, the shorter is dropped."

The example given: `flat light, no shadows` alongside
`flat overcast light, no cast shadows`.

Jaccard check on these two: token sets are `{flat, light, no, shadows}` and
`{flat, overcast, light, no, cast, shadows}`. Intersection = 4, union = 6.
Jaccard = 0.67. Below the 90% threshold — not caught.

Substring check: "flat light, no shadows" does not appear as a literal
substring within "flat overcast light, no cast shadows." Not caught.

By the algorithm as documented, these two fragments would NOT be deduplicated,
contradicting the document's own example.

Verify the actual deduplication logic in `assembler.js`. Either the algorithm
is more sophisticated than described (normalises whitespace/punctuation before
substring matching, or uses a lower threshold), or the example is wrong, or
there is a real gap in deduplication.

---

### 4. Display priority stack creates a polish result that cannot be seen

The PromptOutput display priority is:
```
1. Manual edit
2. Restored text (from history or saved prompts)
3. Selected variant
4. AI-polished output
5. Assembled prompt
```

If the user restores a saved prompt (priority 2) and then clicks "Polish with
AI", the polish result (priority 4) is hidden behind the restored text
(priority 2). The user clicks Polish and sees no change in the display.

The same issue applies to variants: selecting a variant (priority 3) then
polishing produces a hidden polish result (priority 4).

Polish fires on the assembled prompt, not on whatever is displayed. This means
the polish output and the displayed text are already decoupled — but the
priority stack makes the polish result invisible in common usage patterns.

**Fix:** Polish and Variant selection should both be treated as "user
intentional display overrides." Explicitly triggering Polish should clear the
Restored/Variant display state and show the polish result — or the priority
stack should place "most recently triggered user action" at priority 1
regardless of type.

---

### 5. Manual edit persistence after chip change is undefined

The document states manual edit sits at display priority 1 and does not sync
back to chip state. But what happens when the user makes a manual edit and
then changes a chip?

The assembled prompt regenerates. Does the manual edit:

**(a) Persist** — the display is now showing stale text that no longer reflects
chip state. The quality score and validation warnings run on the assembled
prompt while the display shows something different.

**(b) Get cleared** — the user loses their edit every time they touch a chip.

Neither behavior is documented. If (a), the quality score and validation system
are analysing text the user isn't seeing. If (b), the document should say so
explicitly.

**Fix:** When the user makes a manual edit, show a persistent indicator that
the display is in "manual edit mode" and chip changes will not update it. Add
a "Reset to assembled" CTA. Make the one-way flow visible rather than
surprising.

---

### 6. Director scenario syntax — template literals inside single-quoted strings

The documentation shows:
```js
s: {
  1: (c) => ['scenario text ${c[0]}', 'alternate scenario', ...],
}
```

`${c[0]}` inside single-quoted strings is literal text, not interpolation.
This would only work with backtick template literals.

Either: (a) the documentation is wrong and the actual code uses backticks —
documentation error only. Or (b) there is a separate post-processing step
that handles `${c[0]}` as a placeholder after the string is returned — this
step is then undocumented and could be a source of bugs when new scenarios
are written by someone who doesn't know about it.

Verify against the actual `directors.js` and document the mechanism accurately.

---

## ARCHITECTURAL ISSUES

---

### 7. Prompt Builder uses localStorage — everything else has moved to SQLite

The Prompt Builder persists to `localStorage`:
- Prompt history (12 most recent)
- Saved prompts (up to 30)
- Workspace profiles
- All chip/director/character state

The P4 session specifically migrated Casting Room archive state from
localStorage to SQLite because localStorage is browser-specific, wiped by
"clear browser data" silently, and cloud-incompatible. All the same arguments
apply here.

A user who clears browser data loses all 30 saved prompts and their entire
prompt history with no warning and no recovery path.

**Fix:** Migrate saved prompts and workspace profiles to SQLite before cloud
deployment. Add API endpoints: `GET/POST /api/saved-prompts`,
`GET/POST /api/profiles`. Prompt history can remain in localStorage (it is
genuinely ephemeral) but saved prompts represent real work product.

---

### 8. No connection between Prompt Builder characters and Actor Bank characters

The Prompt Builder `chars` state is:
```js
[{ g: 'man'|'woman'|'person', a: '20s'|'30s'|... }, ...]
```

Anonymous demographic descriptors. No connection to the Casting Room's named
characters (Lena Sholk, age 27, specific appearance, reference images, prompt
packs) that live in SQLite with a full data model.

There is currently no way to use an Actor Bank character in the Prompt Builder.
A user who has built a cast of 12 characters in the Casting Room and wants to
compose a scene using the Prompt Builder's director/scenario system must
manually describe them again from scratch.

This is the most significant missing integration in the application. The
scenario template system (`${c[0]}` substitution) is already designed for
dynamic character descriptions — it just needs to pull from the Actor Bank
instead of anonymous demographic inputs.

**Future fix (Horizon 2 — after Actor Bank UI is complete):**
Add an "Import from Actor Bank" option to the character selector. When an
Actor Bank character is selected, their profile description (appearance,
archetype, distinguishing features) populates the character descriptor used
in scenario substitution. Their visual signature could also inform chip
pre-selection. This is the integration that makes the whole application
coherent as a unified production tool rather than two separate utilities.

---

### 9. Director blending is underspecified — likely creates validation conflicts

"The blended chip set is computed by interleaving chips from both presets
weighted by the slider."

Specific questions not answered:
- If both directors have a chip in the same dimension (both have a Film Stock
  chip, both have a Light chip), which one appears?
- Does "interleaving weighted by slider" mean probabilistic per-chip selection,
  or proportional selection from each director's full list?
- What prevents conflicting chips in the same dimension?

The validation system flags more than one light chip as a coherence error.
If blending two directors regularly produces two light chips (one from each),
the validation system will fire on every blend — an annoying experience that
makes blending feel broken rather than intentional.

**Fix:** Document the actual blending algorithm. Verify that same-dimension
conflicts are resolved deterministically (primary wins, weight-weighted
selection of one chip). If they are not resolved, add dimension-level conflict
resolution to the blend computation.

---

### 10. URL sharing scope is overstated

The document states all state lives in App.jsx to enable "URL sharing to
operate across the full system state." The Casting Room has its own separate
state (characters, batches, jobs). URL sharing encodes Prompt Builder state
only. "Full system state" should read "full Prompt Builder state."

---

## UX ISSUES

---

### 11. "Scene matcher" is referenced but never explained

Under Design Decisions: "Whenever the user...runs the scene matcher, the
system captures the before/after chip state and shows a transient diff panel."

"Scene matcher" appears nowhere else in the document. No description, no
section, no mention of what it does. Either this is a planned feature
referenced by mistake, or it exists in the codebase and was omitted from the
documentation.

If it exists: add a section explaining it.
If it's planned: remove the reference until it is built.

---

### 12. Variant selection state after chip change is undefined

Three variants are auto-generated and override displayed text "without
affecting chip state." What happens when a variant is selected and then a
chip changes? Does the variant persist (displaying stale text) or clear
(resetting to the new assembled prompt)?

Same class of problem as Issue #5. The behavior should be consistent and
documented: variant selection clears on chip change, or stays with a visible
"stale" indicator.

---

### 13. Quality score penalizes non-cinematic prompt styles

Anti-CGI anchors are worth 20 points (second highest weight). Named film stock
language is worth 15 points. Together these constitute 35% of the score.

For a user building prompts targeting illustration, graphic novel, painterly,
or animation-adjacent styles, these anchors are wrong signals that actively
contradict their intent. They would score ≤ 65/100 regardless of prompt quality.

The quality score currently assumes all prompts are cinematic/photorealistic.

**Fix:** The quality score breakdown is already displayed — make the component
labels clear enough that users understand what drives their score and can
weight it appropriately for their use case. Or add a mode selector
(cinematic / stylized) that adjusts the scoring weights.

---

### 14. Saved prompts cap: 30 entries, cap behavior undocumented

What happens at 30 saved prompts? Does the oldest get dropped silently? Does
the save action fail with an error? Is there a warning before the cap is hit?

30 is also a small number for production use across multiple projects.

**Fix:** Document the cap behavior. The cap likely exists due to localStorage
size constraints — it disappears once saved prompts move to SQLite (Issue #7).

---

## MINOR

---

### 15. REWRITES order sensitivity risk is acknowledged but unmitigated

AGENT_HANDOFF.md noted this as technical debt: "A later pattern can match
something introduced by an earlier rewrite." The Prompt Builder documentation
doesn't mention this risk. As the REWRITES table grows, the probability of
a cascade rewrite producing wrong output increases.

The fix is simple and was already identified in the handoff: add a Vitest
test suite for `assembler.js`. It's a pure function — unit testing is
straightforward. Without tests, the REWRITES table is an untested accumulation
of string transforms.

---

### 16. Prompt history 12-entry limit has no rationale

12 is a specific number with no explanation. Is it a localStorage size
constraint? A UI layout decision? A deliberate philosophy? If localStorage,
it disappears with server-side persistence. If intentional, note why.

---

## Summary Priority Table

| # | Issue | Priority | Type |
|---|---|---|---|
| 4 | Polish result hidden by Restored Text in priority stack | Critical | Logic |
| 5 | Manual edit persistence after chip change undefined | High | Logic |
| 3 | Deduplication example likely incorrect | High | Logic |
| 7 | Prompt Builder localStorage vs SQLite inconsistency | High | Architecture |
| 8 | No connection between Prompt Builder chars and Actor Bank | High | Architecture |
| 2 | Polish covers 15 directors, system has 60 | High | Logic |
| 1 | Director count contradiction (25 vs 60) | Medium | Documentation |
| 9 | Director blending underspecified, possible validation conflicts | Medium | Logic |
| 6 | Scenario template syntax may be incorrect in docs | Medium | Documentation |
| 11 | Scene matcher referenced but unexplained | Medium | Documentation |
| 12 | Variant state on chip change undefined | Medium | UX |
| 13 | Quality score penalizes non-cinematic styles | Medium | UX |
| 10 | URL sharing scope overstated | Low | Documentation |
| 14 | 30 saved prompts cap behavior undocumented | Low | UX |
| 15 | REWRITES order sensitivity unmitigated | Low | Architecture |
| 16 | Prompt history 12-entry limit unexplained | Low | UX |

---

*Analysis version: 1.0*
*Against: About the Prompt Builder Tab*
