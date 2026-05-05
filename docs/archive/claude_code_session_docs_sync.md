# Claude Code Session — Documentation Sync
*Paste this as your opening message in a new Claude Code session*

---

## Tooling Setup — Do This First

```bash
bd doctor || bd init --quiet
bd setup claude
```

---

## Issue Graph — Create All Issues Now

```bash
# ── EPIC ──────────────────────────────────────────────────────────────

bd create "Sync FULL_GUIDE.md to current code state" \
  --description="The guide contains four specific contradictions introduced by the P4 session fixes. Code is correct. Documentation needs to catch up. No code changes in this session — documentation only." \
  -t epic -p 1 --json
# Save returned ID as EPIC_ID

# ── AUDIT FIRST (no blockers) ─────────────────────────────────────────

bd create "Audit all documentation files for stale content" \
  --description="Use Serena to find every .md file in the project. Read each one. List every place that mentions: localStorage and archive state, Journey A character promotion, Dismiss behavior, the convergence point between Journey A and Journey B at Active Character, and any description of what 'Select this look' does. Output: a file-by-file list of stale lines with exact line numbers and what they currently say. Do not edit anything in this task." \
  -t task -p 1 \
  --deps "parent:EPIC_ID" --json
# Save as AUDIT_DOCS

# ── FIXES (blocked on audit) ──────────────────────────────────────────

bd create "Fix Section 1 changelog — archive localStorage reference" \
  --description="In FULL_GUIDE.md, find the P3 entry in Section 1 ('What Was Recently Completed'). The line currently reads 'Archive state is stored in localStorage.' Update it to accurately reflect that archive state is now persisted to SQLite via an archived_at column, survives browser clears, and is cloud-compatible. Preserve the surrounding P3 content unchanged." \
  -t task -p 1 \
  --deps "blocks:AUDIT_DOCS" --json

bd create "Fix Section 1 changelog — P1 Journey A note now incorrect" \
  --description="In FULL_GUIDE.md, find the P1 entry in Section 1. The line currently reads 'Characters generated in Journey A no longer appear in the Active Character dropdown (which is reserved for Journey B approved characters).' This is no longer true — Journey A characters now promote to Active Character after 'Select this look'. Update this line to reflect the current behavior: Journey A characters are created in the database at generation time and appear in Active Character after the user clicks 'Select this look'." \
  -t task -p 1 \
  --deps "blocks:AUDIT_DOCS" --json

bd create "Add P4 session entry to Section 1 changelog" \
  --description="In FULL_GUIDE.md, add a new changelog entry at the top of Section 1 (above P3) for the P4 session. Title it 'P4 — Flow Fixes and Documentation Sync (May 3 2026)'. List all changes made in the P4 session accurately: (1) Archive state migrated from localStorage to SQLite via archived_at column; new archiveCharacter and restoreCharacter API endpoints. (2) Journey A promotion confirmed and UI feedback added — 'Select this look' now saves character to database and shows scroll-to confirmation. (3) Journey B Dismiss changed to soft-delete; 'Show dismissed (N)' toggle and 'Reconsider' button added. (4) Portfolio section now shows conditional copy reflecting whether the active character already has audition images. (5) Project tone field in batch form now has tooltip and is wired to LLM prompt with aesthetic examples. (6) All five feature flags documented with descriptions. (7) Polling interval removed from user-facing UI copy." \
  -t task -p 1 \
  --deps "blocks:AUDIT_DOCS" --json

bd create "Fix Journey A workflow diagram — Select this look outcome" \
  --description="In FULL_GUIDE.md, find the Journey A workflow diagram in Section 3. The line currently reads: 'Select this look → candidate marked selected'. Update it to show the actual outcome: the character is saved to the database and appears in Active Character. Suggested replacement: 'Select this look → character saved, appears in Active Character ↓'. Also verify the Journey A diagram includes the scroll-to / confirmation message behavior if it warrants a note — add one line if so." \
  -t task -p 1 \
  --deps "blocks:AUDIT_DOCS" --json

bd create "Fix Journey B workflow diagram — Dismiss behavior and convergence note" \
  --description="In FULL_GUIDE.md, find the Journey B workflow diagram in Section 3. Two updates needed: (1) The line 'Dismiss → removed from batch' is no longer accurate. Update it to: 'Dismiss → hidden from batch (recoverable via Show dismissed)'. (2) The line '(same as Journey A from here)' is no longer accurate because the two journeys arrive at Active Character in different states — Journey A already has audition images in the Gallery, Journey B has none. Replace it with a note that acknowledges this: 'Active Character section (Journey B arrives with no images — Queue Portfolio to generate the first set)'." \
  -t task -p 1 \
  --deps "blocks:AUDIT_DOCS" --json

bd create "Check all other .md files for stale content and update" \
  --description="Based on the audit findings: check every other .md file identified (CASTING_ROOM_HOWTO.md and any others) for the same four categories of stale content — archive localStorage references, Journey A promotion descriptions, Dismiss behavior descriptions, and the Journey A/B convergence description. Apply equivalent corrections to each file found. If a file is already accurate, close with a note confirming it was checked and is clean." \
  -t task -p 2 \
  --deps "blocks:AUDIT_DOCS" --json
```

---

## Working Protocol

### Starting each task

```bash
bd ready --json
bd update <id> --claim --json
```

### Use Serena to find before editing

Before editing any file, use Serena to locate the exact lines. Do not search manually or assume line numbers from memory — the guide has been through multiple revisions and line positions shift. Find the text, confirm it matches what is described in the task, then edit.

### One file at a time

Do not batch-edit multiple files in a single operation. Edit one file, verify it reads correctly, then move to the next task.

### Do not rewrite surrounding content

Each task specifies the exact lines to change. Edit only those lines. Do not restructure sections, reformat tables, reorder content, or improve adjacent writing that isn't listed as stale. The goal is surgical accuracy, not a general rewrite.

### Closing tasks

```bash
bd close <id> --reason "Updated line X in FILENAME: [old text] → [new text]" --json
```

Include the actual old and new text in the close reason so there is a clear audit trail.

### Session end

```bash
bd sync
```

---

## Constraints

- Documentation files only — no code changes
- Edit only the specific lines identified as stale
- Preserve all surrounding formatting, structure, and content
- Do not update the `> Last updated:` date in the guide header — leave that for manual update

---

## Definition of Done

- `bd list --status open --json` returns zero open issues under this epic
- Section 1 of FULL_GUIDE.md has a P4 entry that accurately lists all changes
- Section 1 P3 archive note reflects SQLite, not localStorage
- Section 1 P1 Journey A note reflects current behavior
- Journey A workflow diagram shows promotion to Active Character
- Journey B workflow diagram shows soft-delete Dismiss and asymmetric convergence
- All other .md files checked and either updated or confirmed clean
- `bd sync` run
