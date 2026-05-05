# Casting Room — Flow Analysis & Issues
*Against: CASTING_ROOM_HOWTO.md*

---

## Summary

The app has solid backend infrastructure but the user-facing flow has accumulated several structural problems that will block real-world use. Issues are grouped by severity. Most are fixable without deep architectural changes — they're UX/flow decisions that hardened in the wrong direction.

---

## CRITICAL — Flow Breaks

These are places where a real user will get stuck, confused, or produce wrong output.

---

### 1. The "convergence" is a fiction

The document claims both journeys "converge at Active Character → Portfolio → Gallery." They don't, and the divergence creates a silent correctness problem.

**Journey A** auto-queues two Comfy jobs (front + profile portrait) in Step 4, before the user has approved anything. These images are saved to the DB and presumably visible in the Gallery. Then the convergence section has its own Portfolio queue (Step 5) for all 6 views.

**Journey B** generates no images at all until the convergence section.

**The problem:** A Journey A user who reaches the Gallery in Step 6 (convergence) may already have images there — from the automatic queuing in Journey A Step 4. They then also run "Queue Portfolio" and generate a second set. The Gallery now contains two sets of images for the same character from two different points in the flow, with no visual distinction between them. There is no indication this will happen and no guidance on what to do about it.

**Fix:** Journey A should either (a) skip the Portfolio queue step entirely and route directly to the Gallery it already populated, or (b) not auto-queue in Step 4 and instead let the user reach the Portfolio step normally. The current hybrid does both and creates ghost data.

---

### 2. Journey A characters don't reliably reach the Active Character dropdown

Journey B has an explicit **Save → Active Character** button. Journey A has no such step — characters are auto-saved to the DB during "Generate Auditions." But the Active Character section (convergence Step 4) shows "all saved characters." The document doesn't confirm whether Journey A characters appear there automatically or require an additional action.

If they don't appear: Journey A has no path to the Portfolio step and is a dead end after the Gallery.
If they do appear: Journey B's explicit "Save → Active Character" step is redundant and the asymmetry between journeys is confusing.

**Fix:** Be explicit. Journey A characters should auto-appear in Active Character (they're already in the DB). Remove the "Save → Active Character" step from Journey B — approval should auto-promote to Active Character, or the system should handle this transparently.

---

### 3. Journey B has no in-app batch generation

The document states: *"This path assumes batches have been generated via the API (e.g. via POST /api/characters-generate-batch with persistBatch: true)."*

There is no in-app UI to trigger batch generation. Journey B effectively starts outside the application. A user who follows this guide and sees "No batches found" is told to hit a raw API endpoint — something no non-technical user will do.

**Fix:** Add a **Generate Batch** form to the Batch Pipeline section, or clearly label Journey B as "developer/technical path only" and remove it from the user-facing guide. If it stays, the empty state must include a CTA that triggers generation from within the UI.

---

### 4. "More Takes" gate condition is wrong

Journey A Step 7: *"After you approve at least one view in a candidate pair, a More takes panel appears."*

The stated use case for More Takes is to generate additional views. But approval is supposed to mean "this image is good." If both auto-generated images failed (Comfy error, bad output), the user cannot approve either — so the More Takes panel never appears and they have no way to retry or generate additional views for a failed candidate without going outside the app.

**Fix:** "More Takes" should be gated on the job reaching a terminal state (success OR failed), not on user approval. Approval and requesting additional takes are orthogonal actions.

---

### 5. Approval means three different things

The word "Approve" is used for three distinct actions in the same flow:

| Location | What "Approve" does |
|---|---|
| Journey A Step 6 — Audition view card | Marks one specific VIEW's audition record as approved |
| Journey B Step 2 — Batch candidate card | Marks the entire CANDIDATE PROFILE as approved (no images involved) |
| Convergence Step 6 — Gallery card | Marks a specific generated IMAGE as approved |

These are three different objects (view record, character profile, image record) with three different effects. The same word and presumably the same button style is used for all three. A user navigating both journeys will have a deeply inconsistent mental model of what approval means and whether they need to do it more than once for the same character.

**Fix:** Distinguish these actions visually and verbally. Suggestions: "Select this look" (audition view), "Cast this character" (batch candidate), "Keep" / "Discard" (gallery image). Or collapse the approval steps — there's no reason a user needs to approve at three separate stages.

---

## SIGNIFICANT — Structural Confusions

These don't break the flow entirely but will cause repeated friction and misunderstanding.

---

### 6. "Character Bank Entry" vs "Actor Bank" naming collision

Journey A Step 1 creates a **Character Bank Entry** — a text brief (name + description) used as seed input to the LLM. The LLM then generates N distinct character profiles from that one entry.

The broader product concept uses **Actor Bank** / **Character Bank** to mean the collection of finished, generated characters ready for production use.

These are opposite ends of the pipeline (input seed vs output character) but share almost identical names. A user who reads about the "Character Bank" in any context — navigation, empty states, error messages — will not know which kind of bank is meant.

**Fix:** Rename the input seed concept. Suggestions: **Character Brief**, **Casting Brief**, **Role Description**, **Seed**. Reserve "Bank" vocabulary exclusively for the collection of finished characters.

---

### 7. "Classification" and "reviewStatus" use conflicting vocabulary on the same card

Journey B Step 2, each candidate card shows both:
- **Classification**: `accepted` / `needsMutation` / `rejected` — set by the automated similarity check at generation time
- **Review status**: `pending` / `approved` / `rejected` — set by the human user

The word `rejected` appears in both fields with different meanings. A candidate can be simultaneously "Classification: rejected" (too similar to existing characters) and "Review status: pending" (user hasn't reviewed it yet). Or the user can reject a candidate that the system classified as "accepted."

**Fix:** Rename the system classification field to something that doesn't overlap: **Similarity check**: `unique` / `needs change` / `too similar`. Or visually separate system metadata from user actions with a clear header or section divider.

---

### 8. Step numbering creates a false continuity

Journey A has Steps 1–7. Journey B has Steps 1–3. Then both enter a section called "Active Character → Portfolio → Gallery" with Steps 4–6.

This implies Journey B's Step 3 connects directly to convergence Step 4. Journey A's Step 7 also connects to convergence Step 4. But Journey A Step 7 ("More Takes") is optional and post-approval — the actual logical end of Journey A's core path is Step 6 (first approval). Step 7 is a sidebar.

The numbering buries this and makes the convergence step numbers feel arbitrary (why does convergence start at Step 4?).

**Fix:** Don't number across sections. Use section headers as structural markers. Steps within a section are numbered from 1 within that section. The convergence section starts at Step 1, not Step 4.

---

### 9. "Compile Prompt Packs" vs "Load Existing" requires user memory

Convergence Step 4: *"If you already compiled packs in a previous session, click Load Existing instead to reload without recompiling."*

This puts the burden of remembering whether packs exist on the user. The UI should check automatically. If packs exist → show them with an option to recompile. If no packs exist → compile automatically or show a single CTA. The two-button "Compile vs Load" pattern is a developer-facing decision leaking into the user flow.

**Fix:** On entering the Active Character section, auto-check for existing prompt packs. If found, display them immediately. Show a "Recompile" option (not the primary action). If not found, show a single "Compile Prompt Packs" button.

---

### 10. Workflow selection happens at two different points with no connection explained

In Journey A Step 4, Comfy jobs are queued automatically. No workflow selection is shown.
In convergence Step 5, the user explicitly selects a workflow before queuing the Portfolio.

The document never explains what workflow Journey A uses for its automatic queuing. Is it a default? The last selected? Hardcoded? If the user has a specific workflow they want to use, they have no way to specify it during the Journey A auto-queue step.

**Fix:** Either expose workflow selection in Journey A's "Generate Auditions" step (before auto-queuing), or document clearly what workflow is used and why.

---

## MINOR — Polish & Clarity

These are lower-stakes issues but worth fixing before the app reaches other users.

---

### 11. Prerequisites table mixes Journey A and Journey B requirements without labelling them

LM Studio is only needed for Journey A. `ENABLE_CHARACTER_BATCH_API=true` is only needed for Journey B. The table lists all requirements together without indicating which journey needs what. A Journey B user will try to get LM Studio running for no reason.

**Fix:** Add a "Required for" column to the prerequisites table: `Both` / `Journey A only` / `Journey B only`.

---

### 12. Polling state is not page-navigation safe

Step 5 (Journey A) and convergence Step 5 describe automatic polling that stops when all jobs are terminal. There is no mention of what happens if the user navigates away (switches tabs, refreshes the page) while polling is active.

If polling state is in React component memory, it's lost on navigation. Images may still be generated by ComfyUI but never ingested until the user manually runs "Ingest Outputs" from Developer Tools — which most users won't know to do.

**Fix:** Either make polling resumable on re-render (check for non-terminal jobs on mount and resume polling), or add a visible "Resume checking" state when the user returns to a view with pending jobs. The Developer Tools "Ingest Outputs" button should not be the recovery path for normal users.

---

### 13. Gallery has no structural connection to the character that generated it

Convergence Step 6: *"Images for the active character appear automatically as they are ingested."*

The Gallery only shows images for whichever character is currently "active." If the user switches the Active Character dropdown to a different character, the gallery changes. This means the Gallery is not a persistent record — it's a filtered view of a selected character's images. But it's called "Gallery" which implies permanence.

This isn't necessarily wrong, but it's not explained. A user who generates images for character A, then switches to character B to do the same, may think they've lost character A's gallery.

**Fix:** Add a visible label in the Gallery header: "Showing images for: [Character Name]." Make it clear the Gallery is per-character, not a global collection.

---

### 14. No path to edit or delete characters after creation

The entire document describes creating characters and generating images, but there is no mentioned way to rename a character, update their profile, or remove them from the Active Character dropdown. The dropdown will grow indefinitely with no management tools.

**Fix:** Add character management — at minimum, rename and archive. This is exactly what the Actor Bank UI (from the implementation brief) would provide.

---

## Meta-issue: Two journeys, different completeness levels

Journey A is fully end-to-end within the app. Journey B requires external API calls to even begin and has no image generation step of its own before the convergence. These are not two equivalent paths to the same outcome — they're at very different levels of completion.

For a non-technical user, Journey B is currently unusable without developer help. Either complete it (add in-app batch generation trigger) or don't present it as a peer to Journey A.

---

*Analysis version: 1.0*
*Reviewed against: CASTING_ROOM_HOWTO.md*
