# True Inline Notes, Refresh, and Layout Fix Report

## Scope

This pass focused on the document editing surface rather than new features. The main goals were to remove action/status clutter, make notes behave like temporary document instructions, make `Apply Notes & Refresh` visibly revise text in mock mode, clean selected translation output, and keep the mockup-aligned layout stable.

## Changes

- Removed the top action-stage chips (`Preparing context`, `Drafting preview`, `Ready`). Generation progress now stays inside the bottom workflow button.
- Hid the Next.js development indicator with `devIndicators: false` in `next.config.ts`.
- Rendered notes as anchored inline document instructions in the editor highlight layer. Notes remain separate from canonical `module.text` and are stored in `module.patches`.
- Kept normal HTML/rich essay export free of notes. Full project JSON still includes notes, patches, snapshots, annotations, sources, and assistant history.
- Made `Apply Notes & Refresh` use unresolved notes as revision instructions and return an accept/reject preview before changing text.
- Added deterministic mock handling for Chinese and English note instructions such as longer titles, less awkward research questions, shorter wording, more academic wording, and English cleanup.
- Added source-text safety for notes previews so stale previews cannot overwrite manual edits made after preview creation.
- Cleaned selected translation fallback output so it is scoped to the selected/active text, read-only, and free of provider/debug wording.
- Simplified visible provider/status language in refresh, assistant, and translation fallback flows.
- Improved editor readability and note styling while preserving textarea-based editing and paragraph behavior.

## Snapshot Behavior

The following operations snapshot before applying destructive or semi-destructive changes:

- Generate Next before overwriting the target module.
- Accepting `Apply Notes & Refresh` before changing the current module.
- Accepting assistant rewrite/academic suggestions before replacing selected text.
- Clear/import paths already preserve backup snapshots according to the project workflow.

## Notes Semantics

- `module.text` remains essay text only.
- Inline notes are visual editor decorations backed by `module.patches`.
- Normal rich text and HTML exports exclude notes.
- Full project JSON includes notes for recovery and continued editing.
- Accepting a notes revision resolves/removes visible note markers; rejecting keeps both text and notes unchanged.

## Screenshots

- `docs/true-inline-note-module1.png`
- `docs/true-inline-note-after-selection.png`
- `docs/apply-notes-revision-preview-title.png`
- `docs/apply-notes-revision-preview-question.png`
- `docs/translation-clean-selected.png`
- `docs/left-rail-compact-final.png`
- `docs/top-no-stage-chips.png`
- `docs/highlight-no-blank-bar-final.png`
- `docs/right-edit-clean-final.png`
- `docs/module2-after-generate-final.png`

## Validation

- `npm install` completed; npm audit still reports 2 moderate vulnerabilities.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 5 files, 20 tests.
- `npm run smoke` passed: 5 files, 20 tests, homepage runtime returned 200.
- `ESSAYCRAFT_FORCE_MOCK_AI=1 npm run test:e2e` passed: 30 tests.
- `npm run build` passed.

## Remaining Limitations

- Inline notes use an anchored decoration layer over the textarea rather than a full rich-text editor. This preserves stable typing, selection, IME behavior, and canonical plain text, but it is not a full collaborative-comment engine.
- Mock note revision is deterministic and designed for demo reliability. Real provider output still depends on the configured DeepSeek model and timeout behavior.
- Source verification/search remains manual by design in this MVP; EssayCraft still must not invent real citations.
