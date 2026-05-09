# Practical Minimal Editor Pass

Branch: `feat/practical-minimal-editor-pass`

## What Changed

- Kept the fixed one-screen workspace and removed visible tool clutter from the primary workflow.
- Refined patch notes into small amber inline document instructions. Notes are stored in module patch metadata and are not inserted into canonical `module.text`.
- Made the note editor smaller and positioned it near the selected sentence/range instead of presenting it as a large separate panel.
- Kept the separate Notes panel absent from the default writing surface.
- Kept the primary toolbar to Back, Generate Next, and Refresh / Apply Notes & Refresh.
- Kept Reference Translation and export actions in the right-side tabs.

## Inline Notes

- `Ctrl/Cmd+Enter` opens a note editor for the active sentence or selected range.
- `Enter` saves, `Shift+Enter` adds a line, and `Esc` cancels.
- Saved notes appear as amber inline markers in the document area.
- Notes can be Chinese or English.
- Notes are included in full project JSON but excluded from normal essay text and normal HTML/rich exports.

## Apply Notes & Refresh

- When unresolved notes exist, Refresh becomes `Apply Notes & Refresh`.
- The app sends current module text, annotations, notes, sources, and module number to `/api/refresh`.
- The route treats notes as revision instructions and returns a revision preview.
- Accept snapshots first, applies revised text, refreshes annotations, resolves applied notes, and creates an undo entry.
- Reject leaves both text and notes unchanged.

## Edit Panel

- Assistant still has only `Chat` and `Edit`.
- Edit mode has one instruction box and four actions: Rewrite, Make academic, Translate, Explain highlight.
- Rewrite and Make academic return Accept / Reject / Copy previews.
- Translate and Explain highlight are read-only outputs with Copy / Reject only.
- Confidence, provider, fallback, and relabel controls are hidden from the normal user UI.

## Rewrite Instruction Handling

- Mock assistant rewrites now read the user's instruction.
- `longer`, `expand`, `更长`, and `更详细` produce a more developed replacement.
- `shorter`, `concise`, `更短`, and `精简` produce a shorter replacement.
- `academic`, `formal`, `正式`, and `学术` produce more academic wording.
- Banned meta phrases are stripped from visible replacement text.

## Left Rail And Highlight Key

- The left module rail remains compact.
- The Highlight Key is in the left sidebar and uses filled highlighter chips.
- The active sentence/selection label outlines the matching key chip in black.
- The bottom horizontal Highlight Key remains removed.

## Screenshots

- `docs/practical-pass-module1-clean.png`
- `docs/practical-pass-inline-note-in-editor.png`
- `docs/practical-pass-apply-notes-preview.png`
- `docs/practical-pass-rewrite-longer-preview.png`
- `docs/practical-pass-translate-readonly.png`
- `docs/practical-pass-explain-readonly.png`
- `docs/practical-pass-left-rail-key.png`
- `docs/practical-pass-undo-toast.png`
- `docs/practical-pass-chat-mode.png`

## Remaining Limitations

- Inline note placement is an overlay decoration aligned to the text area, not a full rich-text comment engine.
- Undo is scoped to accepted AI edits and accepted note revisions.
- Source search and source verification remain intentionally manual-only.
- The AI provider can still time out; deterministic mock fallback keeps the demo usable.
