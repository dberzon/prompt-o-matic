# Claude Code Session — Casting Room Flow Fixes
*Paste this as your opening message in a new Claude Code session*

---

## Tooling Setup — Do This First

Before writing a single line of code, initialize the task graph:

```bash
# Verify beads is initialized in this project
bd doctor || bd init --quiet

# Set up Claude Code hooks if not already done
bd setup claude
```

Then create the full issue graph below using these exact commands. The dependency structure tells you the correct order of execution — never jump ahead of it.

---

## Issue Graph — Create All Issues Now

Run these `bd create` commands in order. The `--deps blocks:` flags encode what must finish before each item can start.

```bash
# ── EPIC ──────────────────────────────────────────────────────────────

bd create "Casting Room flow fixes" \
  --description="Fix all critical and significant flow issues identified in flow analysis v2. Two journeys must both have complete, consistent paths to Portfolio and Gallery. Archive must be persisted properly. Action labels must have clear, documented outcomes." \
  -t epic -p 0 --json

# Save the epic ID returned here as EPIC_ID
# All tasks below are children of this epic

# ── INVESTIGATION TASKS (no blockers — run first) ──────────────────────

bd create "Audit Journey A promotion path" \
  --description="Use Serena to trace what happens after 'Select this look' is clicked. Find the handler, trace what state it sets, and determine whether Journey A characters ever reach the Active Character dropdown. Output: a written finding — either (a) Journey A characters DO reach Active Character via a code path not documented in the guide, or (b) they genuinely cannot and the flow is broken. Do not fix anything in this task. Find and report only." \
  -t task -p 0 \
  --deps "parent:EPIC_ID" --json
# Save as AUDIT_JOURNEY_A

bd create "Audit archive implementation" \
  --description="Use Serena to find every place 'archive' or 'archived' is written or read in the codebase. Confirm whether archive state is in localStorage, SQLite, or both. Find the archive button handler, the restore handler, and the Active Character dropdown filter. Output: a written finding with exact file and line references." \
  -t task -p 0 \
  --deps "parent:EPIC_ID" --json
# Save as AUDIT_ARCHIVE

bd create "Audit Journey B Dismiss behavior" \
  --description="Use Serena to find the Dismiss handler in the batch pipeline. Determine whether Dismiss performs a hard delete (row removed from DB) or soft delete (status field updated). Find the batch candidate query to confirm whether dismissed records are excluded from the list. Output: finding with exact file and line references." \
  -t task -p 1 \
  --deps "parent:EPIC_ID" --json
# Save as AUDIT_DISMISS

bd create "Audit Actor Bank character scope" \
  --description="Use Serena to find the query that populates the Actor Bank tab. Determine what filter or join condition defines which characters appear there. Does it include Journey A selected candidates? Journey B cast characters only? All characters regardless of journey? Output: the exact query and a plain-language description of what it currently shows." \
  -t task -p 1 \
  --deps "parent:EPIC_ID" --json
# Save as AUDIT_ACTOR_BANK

# ── CRITICAL FIXES (blocked on audits) ────────────────────────────────

bd create "Fix Journey A promotion path to Active Character" \
  --description="Based on audit findings: if Journey A characters cannot reach Active Character, implement a promotion mechanism. 'Select this look' should save the selected candidate as a character in the database (same schema as Journey B cast characters) and make them available in the Active Character dropdown. If the code path exists but is broken, fix the specific breakage. Minimum: after clicking 'Select this look', the character must appear in Active Character and be usable for Portfolio generation. Do not change the Journey B flow." \
  -t task -p 0 \
  --deps "blocks:AUDIT_JOURNEY_A" --json
# Save as FIX_JOURNEY_A

bd create "Migrate archive state from localStorage to SQLite" \
  --description="Add an 'archivedAt' timestamp column (nullable) to the characters table via a migration script. Update the archive handler to write to this column via a PATCH or dedicated POST endpoint. Update the restore handler to null the column. Update the Active Character dropdown query to filter WHERE archivedAt IS NULL. Update the Archived panel query to filter WHERE archivedAt IS NOT NULL. Remove localStorage reads/writes for archive state entirely. The behavior from the user's perspective must be identical — only the persistence layer changes." \
  -t task -p 0 \
  --deps "blocks:AUDIT_ARCHIVE" --json
# Save as FIX_ARCHIVE

# ── SIGNIFICANT FIXES (blocked on their respective audits) ────────────

bd create "Clarify and implement 'Select this look' outcome" \
  --description="After FIX_JOURNEY_A is complete: ensure the UI makes the outcome of 'Select this look' visible. After clicking: (1) the candidate card should show a 'selected' state visually, (2) a confirmation line should appear below the candidate: 'Character saved — find them in Active Character below', (3) the Active Character section should auto-scroll into view or highlight to draw attention. No new backend work needed if FIX_JOURNEY_A is implemented — this is UI feedback only." \
  -t task -p 1 \
  --deps "blocks:FIX_JOURNEY_A" --json

bd create "Make Journey B Dismiss reversible" \
  --description="If audit finds hard delete: change to soft delete. Set a 'dismissedAt' timestamp column on batch candidates (add migration if needed). Update the dismiss handler to set this field rather than delete the row. Update the batch candidate list query to exclude dismissed records by default. Add a 'Show dismissed (N)' toggle below the batch review list that reveals dismissed candidates with a 'Reconsider' button (sets dismissedAt back to null). If audit finds it is already a soft delete with a status field, just add the Show dismissed toggle and Reconsider button — no schema change needed." \
  -t task -p 1 \
  --deps "blocks:AUDIT_DISMISS" --json

bd create "Document Journey A/B asymmetry at Active Character" \
  --description="The two journeys arrive at the Active Character section in different states: Journey A has images already in the Gallery; Journey B has none. Add conditional UI copy to the Active Character section header that reflects this: if the active character has existing gallery images, show 'Your candidate has audition images — queue Portfolio to add more views.' If no gallery images exist, show 'No images yet — queue Portfolio to generate this character's first set.' This is a UI-only change. Read the gallery image count for the active character from the existing API and branch on it." \
  -t task -p 1 \
  --deps "blocks:FIX_JOURNEY_A" --json

bd create "Define and apply project tone to batch generation" \
  --description="'Project tone' (cinematic, editorial, raw) appears in the Journey B batch generation form but has no documented effect. Use Serena to find where the batch generation API call is constructed and where the LLM prompt for character generation is assembled. Add 'project tone' as a parameter that influences the LLM system prompt — e.g. 'cinematic' biases toward dramatic archetypal faces, 'editorial' toward distinctive/unconventional, 'raw' toward naturalistic. Add a one-line tooltip to the field in the UI explaining what it does. Keep the implementation minimal — one conditional phrase injected into the system prompt per tone value is sufficient." \
  -t task -p 1 \
  --deps "parent:EPIC_ID" --json

bd create "Define Actor Bank character scope and enforce consistency" \
  --description="Based on audit findings: the Actor Bank should show all characters that are in a usable state — regardless of which journey created them. After FIX_JOURNEY_A, Journey A characters will be saved to the DB with the same schema as Journey B characters. Update the Actor Bank query to include both. Verify that clicking a character in the Actor Bank correctly loads them as Active Character in the Casting Room for both journey types. If the 'load as Active Character' action is broken for Journey A characters, fix it." \
  -t task -p 1 \
  --deps "blocks:FIX_JOURNEY_A,AUDIT_ACTOR_BANK" --json

# ── MINOR FIXES (low priority, no blockers) ───────────────────────────

bd create "Remove polling interval from user-facing UI copy" \
  --description="Find all instances of '8 seconds' or 'every 8s' or similar polling interval references in UI strings, component copy, or visible status messages. Replace with neutral language: '⟳ checking…' with no interval specified. Do not change the actual polling interval — only remove it from display. Also check docs/CASTING_ROOM_HOWTO.md and docs/FULL_GUIDE.md for any mention of the 8-second interval and remove those references." \
  -t task -p 2 \
  --deps "parent:EPIC_ID" --json

bd create "Document ENABLE_GENERATED_IMAGES_API feature flag" \
  --description="Find in the codebase what ENABLE_GENERATED_IMAGES_API gates. Add a one-line description in the External Services or Environment Variables section of FULL_GUIDE.md explaining what feature this flag controls and what breaks if it is false or absent. No code changes." \
  -t task -p 2 \
  --deps "parent:EPIC_ID" --json
```

---

## Working Protocol

### Starting each task

```bash
# See what's unblocked right now
bd ready --json

# Claim before starting
bd update <id> --claim --json
```

### For every task that touches existing code — use Serena first

Before writing any code for a fix task, use Serena to read the relevant code. The pattern is:

1. Use Serena's `find_symbol` or `search_code` to locate the relevant handler, component, or query
2. Read the full function — not just the line, the whole function
3. Trace its callers and its effects
4. Only then write the fix

Never guess at a file path or function name. Serena will find it precisely. This is especially critical for:
- The Journey A promotion path — the handler chain may be longer than expected
- The archive implementation — localStorage and SQLite may both be involved simultaneously
- The Active Character dropdown query — there may be multiple query sites

### For database migrations

Follow the existing migration pattern in the codebase (find it with Serena before writing a new one). Do not alter tables directly — write a migration script that can be run cleanly. Check for existing `archivedAt` or `dismissedAt` columns before adding them.

### Closing tasks

```bash
bd close <id> --reason "Brief description of what was done and where" --json
```

### Session end — always sync

```bash
bd sync
```

---

## Constraints

- Plain JavaScript only — no TypeScript
- CSS Modules only — no inline styles, no new libraries
- No changes to the prompt builder tab (Tab 1) or character builder tab (Tab 2)
- No changes to the assembler, director system, or chip system
- Schema changes require migration scripts — no direct table alteration
- All new API endpoints must follow the existing handler pattern (use Serena to read an existing handler before writing a new one)
- Do not touch anything not listed in this issue graph

---

## Definition of Done

The session is complete when:
- `bd list --status open --json` returns zero open issues under this epic
- Journey A: clicking "Select this look" results in the character appearing in Active Character with visual confirmation
- Journey B: dismissed candidates can be recovered via a "Show dismissed" toggle
- Archive state survives a browser cache clear (confirm by reading from SQLite, not localStorage)
- Actor Bank shows characters from both journeys
- `bd sync` has been run
