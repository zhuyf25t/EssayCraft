# Demo UX Polish Report

Date: 2026-05-09

## Product Maturity Assessment

EssayCraft now has the core six-module workflow, deterministic mock AI, Generate Next coverage, preview-only Translate, manual source cards, snapshots, import/export, and fixed-shell layout. The remaining maturity work is mostly about reducing visual density and replacing local mock AI with provider-backed quality once a server-side API key is configured.

## Scroll And Focus Fix

Manual testing showed generated Module 3 and Module 4 opening mid-document. Root cause: the same textarea DOM node was reused across module switches and Generate Next, so browser `scrollTop` and the highlight backdrop scroll carried over from the previous module. React state reset the selected range, but the actual textarea scroll and native selection were not reset.

Fixes:

- Added an explicit editor reset key from the workspace.
- Reset textarea scroll, backdrop scroll, and native caret to the top on module switch, Generate Next success, reset demo, import, clear, and snapshot restore.
- Added native `selectionchange` and textarea `select` listeners so the Assistant panel sees actual user selection reliably.
- Added E2E coverage that Module 2, Module 3, and Module 4 open at the top after generation.

## Toolbar And Layout

The previous toolbar exposed too many secondary actions at once and duplicated Snapshot/HTML in the workflow strip. Generate now remains the dominant workflow action while secondary actions live behind a compact More tools panel.

Changes:

- Kept Refresh Highlighting visible as the main AI utility.
- Moved Snapshot, Clear, Export, JSON, Import, Translate, and Reset Demo into grouped More tools sections.
- Removed duplicate Quick Snapshot and Export HTML buttons from the primary workflow strip.
- Kept the app shell fixed with the Highlight Key visible at the bottom.

## Translate

Translate remains preview-only. It does not apply text, overwrite modules, or create snapshots.

Changes:

- Mock/fallback English-to-Chinese output now produces readable Chinese reference text instead of garbled strings or English wrapped in labels.
- Provider output is rejected to fallback when an English-to-Chinese response contains too little Chinese or echoes too much source English.
- E2E verifies Chinese preview, no Apply button, Copy translation availability, unchanged editor text, unchanged snapshots, and preserved editor scroll after modal close.

## AI Assistant

The Assistant is now safer and more selection-aware.

Changes:

- Shows either a real selected range/excerpt or a clear no-selection message.
- Disables targeted actions when no selection exists.
- Sends `selectedRange` only for non-empty selections.
- Hides Apply for reference-only previews without a replace range.
- Blocks invalid replacement ranges before snapshotting or modifying text.
- E2E verifies selected context, disabled empty Ask, preview-first behavior, and Dismiss without document mutation.

## Source Workbench Semantics

Source needs and citation gaps are now clearer.

Changes:

- Source need placeholders are explicitly planning reminders, not real references.
- Insert Citation is disabled for placeholders.
- Reference preview for placeholders explains that no reference can be created until the student supplies metadata.
- Verification wording now says student-reviewed metadata and avoids implying EssayCraft verified a source.
- Demo seed Module 2 and Module 3 use `[source needed: ...]`; Module 4/5 remain the place for `[citation needed]`.

## Module Status

Status no longer treats a snapshot alone as done. The display now separates `current`, `empty`, `has issues`, `in progress`, and `done`, with earlier clean modules displayed as done once the student has advanced beyond them.

## Screenshots

- `docs/demo-polish-module1-top.png`
- `docs/demo-polish-module2-top.png`
- `docs/demo-polish-module3-top.png`
- `docs/demo-polish-module4-top.png`
- `docs/demo-polish-translate-cn.png`
- `docs/demo-polish-assistant-selection.png`
- `docs/demo-polish-source-workbench.png`

## Remaining Limitations

- Source search and source verification are not implemented; source cards remain manual and student-supplied.
- Mock Chinese translation is a readable reference preview, not a professional translation engine.
- The Assistant can preview/apply selected rewrites, but it does not yet compare the original selected text at apply time against a stored preview hash.
- The right rail remains dense on small desktop heights, although it is internally scrollable and the page itself does not scroll.
