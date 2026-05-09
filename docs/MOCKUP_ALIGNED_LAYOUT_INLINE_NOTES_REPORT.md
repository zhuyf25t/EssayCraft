# Mockup-Aligned Layout and Inline Notes Pass

Date: May 9, 2026
Branch: `feat/mockup-aligned-layout-inline-notes`

## Summary

This pass moved EssayCraft closer to the original mockup direction: compact left module rail, central paper editor, right assistant workspace, and a bottom workflow action bar. It also tightened inline note behavior and highlight rendering so notes feel anchored to the document without becoming essay text.

## Top Header

- Removed the persistent stage chips such as `Preparing context`, `Drafting preview`, and `Ready`.
- Kept the top header compact: project title input, current module label, and small module circles.
- Preserved transient toast/status behavior without adding a permanent warning or status row.

## Bottom Workflow Bar

- Moved workflow actions to a fixed bottom action bar inside the app shell.
- The bottom bar now contains Back, Generate/Finalize, Save Snapshot, and Refresh / Apply Notes & Refresh.
- Generate remains the dominant blue action. Refresh changes to `Apply Notes & Refresh` when unresolved notes exist.

## Left Rail and Highlight Key

- Added compact module icons for the six-module pipeline.
- Reduced visual weight in the left rail while keeping all six modules visible at standard desktop size.
- Kept the Highlight Key in the lower-left sidebar with filled marker chips.
- The active annotation label outlines the matching key chip with a black border.

## Inline Notes

- `Ctrl/Cmd+Enter` creates an anchored inline note marker near the selected text or active sentence.
- Notes display as small amber `Note · ...` chips in the document area.
- Notes are stored separately in module patches and do not enter canonical `module.text`.
- Normal essay exports continue to use essay text only; full project JSON includes notes/patches.
- Clicking a note marker reopens the note editor.

## Apply Notes & Refresh

- With no unresolved notes, Refresh only updates annotations and preserves exact text.
- With unresolved notes, Refresh becomes `Apply Notes & Refresh`.
- The route receives current module text plus notes and returns a revision preview before any overwrite.
- Accept snapshots first, applies revised text, refreshes annotations, and resolves applied notes.
- Reject keeps the original text and notes unchanged.
- Mock mode now handles common Chinese note instructions such as `标题可以更长一点` so the demo visibly changes.

## Highlight Rendering Fix

Root cause: stale or whitespace-only annotation ranges could be rendered by the highlight backdrop, creating blank colored bars.

Fixes:

- Editor rendering now ignores invalid, stale, mismatched, and whitespace-only annotation ranges.
- Annotation repair refuses exact matches that are only whitespace.
- Tests cover stale and blank annotation ranges.

## Edit Panel

- Kept the Edit panel focused on one instruction box and four compact actions: Rewrite, Academic, Translate, Explain.
- Translate and Explain remain read-only previews.
- Rewrite and Academic continue to use Accept / Reject / Copy preview cards.
- Highlight explanations now consider the selected sentence content instead of returning only a generic label description.

## Screenshots

- `docs/mockup-pass-module1-layout.png`
- `docs/mockup-pass-left-rail-key.png`
- `docs/mockup-pass-bottom-actions.png`
- `docs/mockup-pass-inline-note-flow.png`
- `docs/mockup-pass-apply-notes-preview.png`
- `docs/mockup-pass-highlight-no-stray-bar.png`
- `docs/mockup-pass-edit-panel-simple.png`
- `docs/mockup-pass-explain-highlight.png`
- `docs/mockup-pass-translate-readonly.png`
- `docs/mockup-pass-module3-layout.png`

## Remaining Limitations

- Inline notes are anchored using estimated text positions rather than a full rich-text editor layout engine.
- The fallback note rewriter is deterministic and useful for the demo, but real quality still depends on the server-side AI provider.
- Source verification/search remains intentionally manual and is not implemented.
