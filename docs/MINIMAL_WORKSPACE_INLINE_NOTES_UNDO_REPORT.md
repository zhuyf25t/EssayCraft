# Minimal Workspace / Inline Notes / Undo Report

Branch: `feat/minimal-workspace-inline-notes-undo`

## Layout

- Removed the full-width project-title mismatch warning row.
- Replaced it with a tiny `!` indicator beside Project Title. The tooltip says Generate uses current module text first.
- Removed the persistent toolbar status pill. Status now appears as a compact auto-dismissing toast.
- The primary toolbar remains only Back, Generate/Finalize, and Refresh / Apply Notes.

## Left Rail And Highlight Key

- The left module rail is narrower and the module cards are shorter.
- The lower-left sidebar now contains the Highlight Key.
- The key uses filled highlighter chips for Background, Thesis, Evidence, Analysis, Counterargument, Citation, Conclusion, and Issue.
- The active sentence or selection label outlines the matching key chip in black.

## Assistant

- Assistant has only `Chat` and `Edit`.
- Chat is informational and never modifies the document.
- Edit works on the active sentence or selected range.
- Edit has one instruction box and four actions only: Rewrite, Make academic, Translate, Explain highlight.
- Translate and Explain highlight are read-only previews with no Accept button.
- Rewrite and Make academic return Accept / Reject / Copy previews.

## Inline Notes

- Ctrl/Cmd+Enter opens a small inline note editor anchored to the active sentence or selected range.
- Notes can be Chinese or English.
- Saved notes display as amber inline chips/markers in the document overlay.
- Notes remain metadata in `module.patches`; they are not inserted into canonical `module.text` and do not appear in normal HTML/rich exports.
- The separate Notes panel is removed from the default writing surface.

## Apply Notes And Undo

- If unresolved notes exist, Refresh becomes `Apply Notes & Refresh`.
- It returns a revision preview first and never overwrites text silently.
- Accept snapshots, applies the proposed revision, refreshes annotations, and resolves applied notes.
- Reject keeps the original text and notes.
- Accepted AI edits and accepted note revisions push an app-level undo entry.
- The toast shows an Undo action after accept, and Ctrl/Cmd+Z can undo the last accepted AI operation before normal typing resumes.

## Remaining Limitations

- Inline notes are visual overlay markers, not a full rich-text comment gutter.
- Undo is intentionally scoped to accepted AI operations, not every manual edit.
- Source verification and source search remain manual-only.
- The small project-title mismatch indicator is informational only and does not offer a choice dialog yet.
