# Casting Room — Flow Analysis v2
*Against: FULL_GUIDE.md (updated May 3 2026)*
*Compared to: CASTING_ROOM_HOWTO.md analysis v1*

---

## What Was Fixed

Almost everything from the previous analysis was addressed. This is a significant improvement.

| Previous issue | Status |
|---|---|
| False convergence / ghost images | ✅ Fixed — double-queue resolved in P1 |
| Journey B requires raw API call to start | ✅ Fixed — Generate Batch form added |
| More Takes gate wrong (approval-based) | ✅ Fixed — now terminal-state-based |
| "Approve" means three different things | ✅ Fixed — distinct labels per context |
| "Character Bank" vs "Actor Bank" naming clash | ✅ Fixed — renamed to "casting brief" |
| Classification / reviewStatus vocabulary overlap | ✅ Fixed — unique / needs change / too similar |
| Step numbering creates false continuity | ✅ Fixed — section-based structure |
| Compile vs Load Existing requires user memory | ✅ Fixed — auto-load on selection |
| Workflow selection missing from Journey A | ✅ Fixed — selector added before Generate |
| Polling not page-navigation safe | ✅ Fixed — sessionStorage resume on re-mount |
| Gallery shows no character context | ✅ Fixed — subtitle added |
| No path to rename or archive characters | ✅ Fixed — P3 additions |

That's 12 out of 14 previous issues resolved. The remaining two (prerequisite labelling by journey, Journey A/B convergence asymmetry) have been partially addressed but generated new variants of the same problem, described below.

---

## CRITICAL — New Issues

---

### 1. Journey A has no path to the Portfolio — this is a broken flow

This is the most important issue in the new guide, and it's a direct consequence of a P1 fix that went too far.

P1 notes: *"Journey A character bleed: Characters generated in Journey A no longer appear in the Active Character dropdown (which is reserved for Journey B approved characters)."*

The fix correctly stopped Journey A from polluting the Active Character dropdown. But it left Journey A without any promotion path.

**The workflow diagram says this:**
```
Journey A — Cast from Bank
  └── Select this look  →  candidate marked selected
  └── (optional) More Takes

Active Character section
  └── Prompt packs auto-load   ← Journey A points here
  └── Queue Portfolio
  └── Gallery
```

**But P1 says:** Active Character is reserved for Journey B approved characters only.

These two statements directly contradict each other. One of them is wrong in the guide — or the fix was incomplete and Journey A genuinely has no path to the Portfolio. If the latter, a user who follows Journey A end-to-end will reach a dead end after "More Takes" with no way to generate a full portfolio for their selected candidate.

**Fix:** Journey A needs its own explicit promotion step. "Select this look" should either (a) directly promote the candidate to Active Character (and the fix should be narrowed to prevent *unreviewed* Journey A characters from bleeding in, not *all* of them), or (b) there needs to be a visible "Use this character" CTA that appears after "Select this look" that triggers promotion. The current state leaves the user stranded.

---

### 2. Archive state in localStorage will be lost — and is cloud-incompatible

P3 notes: *"Archive state is stored in localStorage."*

But character rename is stored in SQLite. This is the wrong split. Archive is a meaningful operational state — it controls what appears in dropdowns, what shows in the Actor Bank, what is "active" in a production context. It is not a UI preference like a collapsed panel or a saved draft.

Consequences of localStorage:
- Clearing browser data unarchives all archived characters silently
- Opening the app in a different browser shows all characters as unarchived
- The cloud version cannot access localStorage state — archive will break on deploy
- Two users sharing a future team account will see different archive states

**Fix:** Move archive state to SQLite immediately. A single `archivedAt` timestamp column on the characters table is sufficient. The cloud migration that's coming will surface this as a breaking issue if it isn't fixed first.

---

### 3. Actor Bank tab is internally inconsistent with the rest of the flow

Tab 4 says: *"Click a character to load them as the Active Character in the Casting Room."*

But if Active Character is reserved for Journey B characters only (per P1), clicking a Journey A character in the Actor Bank would either silently fail, load a character that shouldn't be there, or navigate to a state that contradicts the current rules.

More fundamentally: the Actor Bank's scope is undefined. It says "browse all saved characters" — but does "all" include Journey A selected candidates? Journey B cast characters only? Characters from both journeys only after they've completed the Portfolio step? The guide doesn't say, and the P1 fix creates ambiguity about what "saved" means for Journey A characters.

**Fix:** Define clearly what the Actor Bank contains. Recommendation: it should contain every character that has reached a terminal "usable" state — regardless of which journey created them. The distinction between Journey A and Journey B is a production process detail, not a permanent classification. A character is either in your bank or it isn't.

---

## SIGNIFICANT — Structural Issues

---

### 4. "Select this look" has an undefined outcome

In the Journey A flow, "Select this look" marks the candidate as selected — but the guide never says what "selected" means downstream. It's not the same as "Cast this character" (which explicitly saves to the database and promotes to Active Character). It's not the same as "Keep" (which marks a gallery image). What does the selected state *do*? Does it:

- Enable More Takes (possibly — this seems to be its gate condition now)
- Promote to Active Character (apparently not, per P1)
- Save the character to the database (unclear)
- Enable the Portfolio step (unclear)

Until "Select this look" has a clear documented outcome, the Journey A flow is logically incomplete. Users will click it expecting something to happen and not know what to look at next.

---

### 5. Journey B "Dismiss" is irreversible with no recovery path

Journey B: *"Dismiss → removed from batch."*

There is no mention of a way to undo a Dismiss or see dismissed candidates. By contrast, the archive system for characters has a visible Restore button. The asymmetry is confusing — in the gallery, "Discard" presumably just marks an image, it doesn't delete it. But "Dismiss" in Journey B apparently removes the candidate entirely.

If "removed from batch" means soft-delete (status change), add a "Show dismissed" toggle to the batch review UI. If it means hard-delete, that's the wrong behavior for a review flow — the user should always be able to revisit their decisions.

---

### 6. Journey A and Journey B still arrive at Active Character differently

Despite the convergence language, the two journeys are not symmetric when they reach the Active Character section:

| | Journey A | Journey B |
|---|---|---|
| Images in Gallery on arrival | Yes — 2 images per candidate already generated | No — gallery is empty |
| Prompt packs | Auto-compiled | Auto-compiled |
| Portfolio step | Redundant (images exist) or additive (more views) | Required (no images yet) |

The guide says "same as Journey A from here" for Journey B — but a Journey B user arriving at Active Character sees an empty gallery and must run the Portfolio step. A Journey A user may already have images and may not need to run Portfolio at all (or runs it for additional views). This is a meaningfully different experience and the guide treats it as identical.

**Fix:** Acknowledge the difference explicitly. Journey B should have a note: "Your character has no images yet — Queue Portfolio to generate their first set." Journey A should have a note: "Your candidate already has audition images in the Gallery — run Queue Portfolio to add additional views."

---

### 7. "Project tone" field is introduced without explanation

Journey B's Generate Batch form includes: age range, count, gender, **project tone** (e.g. cinematic, editorial, raw).

This field appears nowhere else in the guide. What does it do? Does it change the LLM prompt used to generate characters? Does it affect the similarity check? Does it influence the ComfyUI workflow selection later? Does it appear as metadata on the generated characters?

A user filling in "project tone: raw" vs "project tone: cinematic" doesn't know if this produces meaningfully different characters or is cosmetic metadata. This needs at least one sentence of explanation.

---

### 8. Tab structure doesn't match workflow structure

The four tabs are:
- Tab 1: Prompt Builder (standalone)
- Tab 2: Character Builder (creates input for Tab 3)
- Tab 3: Casting Room (the main production pipeline)
- Tab 4: Actor Bank (browsing output from Tab 3)

Tab 2 is a prerequisite for Tab 3's Journey A. Tab 4 is essentially a read-only view of Tab 3's output with a single "load character" action. Neither relationship is surfaced in the tab navigation.

A new user will likely use Tab 1 first, then Tab 2, and not immediately understand that Tab 2 feeds Tab 3. And they may treat Tab 4 as a peer workflow rather than a browser. The navigation implies equality between tabs when the actual dependency structure is:

```
Tab 2 → Tab 3 → Tab 4 (read)
Tab 1 (independent)
```

This isn't a critical fix but it's worth noting for the Actor Bank UI design — Tab 4 should feel connected to Tab 3, not separate from it.

---

## MINOR

---

### 9. Prerequisite labelling improved but not complete

The new External Services section is significantly better than the old prerequisites table. However, the "Required for" field in each service section still doesn't distinguish clearly between "required for Journey A" vs "required for Journey B" vs "required for both." LM Studio is listed as required for both, which is correct, but the relationship between the services and specific journeys could be clearer.

Specifically: a user who only wants to use Journey B (batch pipeline) and isn't sure whether they need LM Studio — they do, but the guide doesn't make this obvious in the service section intro. The service sections list use cases but don't say "without this, Journey X will not work at all."

---

### 10. Polling is every 8 seconds — still exposed to the user

Both Journey A Step 5 and the Portfolio step reference the 8-second poll interval explicitly. This is an implementation detail that shouldn't be user-facing. It also sets an expectation — if ComfyUI is slow and the user watches for 8 seconds with no update, they may assume something is broken before the first poll fires.

Minor: the implementation detail should be removed from user-facing docs. The UX surface should just say "checking…" with no interval specified.

---

### 11. ENABLE_GENERATED_IMAGES_API feature flag is undocumented

The full env reference in Section 5 includes `ENABLE_GENERATED_IMAGES_API=true` but this flag is not mentioned in any service section, not explained anywhere in the guide, and no feature is described as requiring it. Either document what it gates, or remove it from the reference if it's internal only.

---

## Summary Assessment

The app has gone from "has several broken flows" to "one broken flow and several rough edges." The P1-P3 work addressed the majority of the previous issues systematically. The remaining critical problem — Journey A's broken promotion path to Active Character — is likely a documentation gap more than a code gap, since the workflow diagram clearly intends Journey A to reach the Portfolio step. But it needs to be explicitly verified and documented either way. The localStorage archive issue is the highest-priority technical fix before cloud work begins.

---

*Analysis version: 2.0*
*Reviewed against: FULL_GUIDE.md (May 3 2026)*
