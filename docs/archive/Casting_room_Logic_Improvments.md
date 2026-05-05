1. Overall Objective
We want to transform the current Casting Room from two somewhat separate paths into one coherent, fluid casting workflow that feels like a real casting session.

The main goals are:

Significantly reduce friction and manual steps
Make both Path A (Audition) and Path B (Batch) feel like part of the same process
Increase visual feedback and automation
Improve user confidence and speed
2. Core Changes
2.1 Automatic Prompt Pack Compilation
Current Problem: Users must manually click "Compile prompt packs" after selecting a newly created character.

Solution:

When a new character record is created (either via runAudition() or saveCandidateAsCharacter()), automatically trigger handleCompileAndListPromptPacks() (or equivalent backend function) in the background.
Show status in the Active Character section: "Compiling prompts..." → "Prompts ready" → "Ready to render"
Remove the manual "Compile prompt packs" button entirely (or keep it only as a "Recompile" option).
2.2 Smart Post-Creation Navigation & Automation
After any action that creates or promotes a character, the system should intelligently move the user forward:

After approving an audition (handleApproveAudition):

Automatically select that character in the Active Character dropdown
Auto-scroll to the Active Character section
Show a prominent toast:
"Character approved. Ready to generate portfolio?"
with a one-click button: "Generate Full Portfolio"
After saving a batch candidate (handleCandidateAction('save')):

Do the exact same auto-select + scroll + toast with "Generate Full Portfolio" button
Add a new combined action in the audition review: "Approve + Generate Portfolio" (this marks the audition as approved and immediately queues the full selected portfolio).

2.3 Quick Visual Previews for Batch Pipeline (Path B)
Current Problem: Batch candidates are text-only, forcing users to save first before seeing images.

Solution:

After generating a batch (handleGenerateBatch), automatically queue Quick Preview renders for each candidate (front portrait only, low resolution, fewer steps).
Display these small preview images in the batch review interface.
Add a button "Generate Previews" (in case ComfyUI was offline during batch creation) that triggers the same quick renders.
This makes Path B visually competitive with Path A.

2.4 Improved Polling Visibility
Current Problem: Polling runs invisibly.

Solution:

Add a persistent status bar at the top of the Casting Room (visible whenever polling is active).
Content example:
"Rendering images • 7 of 12 complete • Audition: 3/5 • Portfolio: 4/7"
Live progress indicators
Show separate sections for "Active Audition Renders" and "Active Portfolio Renders" when relevant.
2.5 Character Lifecycle States
Introduce a status field on the character table:

draft
auditioned
portfolio_pending
ready (has approved portfolio images)
finalized (user has marked complete)
archived
This state should drive UI behavior (e.g., highlight characters that are portfolio_pending).

3. Additional Improvements
"More Takes" should be available for both approved and rejected auditions.
Create a single rich Character Card component to be used across Audition results, Batch review, and Active Character sections for consistency.
After any major action (approve, save, reject, mutate), refresh relevant lists automatically and show clear feedback banners.
4. Priority Order (Recommended Implementation)
Phase 1 (High Impact – Do First)

Automatic prompt pack compilation on character creation
Auto-select + scroll + "Generate Full Portfolio" toast after approval/save
Combined "Approve + Generate Portfolio" action
Persistent polling status bar
Quick preview renders for batch candidates
Phase 2

Character lifecycle states
Unified rich Character Card component
"More Takes" on rejected auditions
Phase 3 (Future)

WebSocket implementation to replace polling
Render priority tiers (Quick Preview > Audition > Portfolio)
5. Expected Benefits
Much smoother and faster user experience
Reduced cognitive load (fewer manual steps)
Both casting paths feel like one unified system
Higher completion rate (users more likely to generate portfolios)
Better visual feedback throughout the process