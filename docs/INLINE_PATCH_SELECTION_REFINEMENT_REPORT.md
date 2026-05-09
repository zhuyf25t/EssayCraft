# Inline Patch and Selection Refinement Report

Branch: `feat/inline-patch-selection-refinement`

## Product Changes

- Assistant now has two normal modes only: `Chat` for module-level conversation and `Edit` for the active sentence, selected range, highlight explanation, notes, and local rewrite previews.
- The separate Inspect surface is removed from normal UI. Highlight information now appears inside Edit mode with a human-readable label and explanation.
- Confidence percentages and relabel dropdowns are hidden from the normal student-facing interface.
- Long selected text is compacted in the side panel using a head/tail excerpt with a character count.

## Inline Notes

- `Ctrl/Cmd+Enter` opens a compact inline note editor anchored to the current sentence or selected range.
- Saved notes appear as amber inline/margin markers and a subtle underline on the anchored text.
- Notes are stored in `module.patches` metadata and are not inserted into canonical `module.text`.
- The note list is collapsed by default so it does not take over the writing surface.

## Apply Notes and Refresh

- If a module has unresolved notes, the toolbar changes from `Refresh Highlighting` to `Apply Notes & Refresh`.
- That action sends module text, annotations, notes, sources, and module number to `/api/refresh`.
- With open notes, refresh returns a revision preview instead of overwriting text.
- Accept snapshots the module, applies the proposed text, refreshes annotations, and resolves the applied notes.
- Reject keeps the module text and notes unchanged.

## Rewrite Cleanup

- Selection rewrite and make-academic actions now sanitize provider/mock output before showing it.
- Visible meta phrases such as `A more academic version could state`, `Here is a revised version`, and factual-evidence citation warnings are stripped.
- Topic/research/thesis lines are not given fake citation warnings by local rewrite fallback.

## Highlight Key and Colors

- Editor highlights were strengthened while staying soft and highlighter-like.
- The bottom Highlight Key now uses visible marker chips for Background, Thesis, Evidence, Analysis, Counterargument, Citation, Conclusion, and Issue.
- Issue highlights remain red-tinted and underlined.

## Remaining Limitations

- Inline note markers are approximate visual anchors in the textarea/highlight overlay rather than a full rich-text comment system.
- Patch-driven revisions are deterministic in mock mode and intentionally conservative.
- Relabel remains available only through metadata/API paths, not through the normal UI.
- Source search and citation verification are still manual-only.

## Validation

- Unit tests and smoke tests cover text preservation, mock AI contracts, import/export, and runtime 200.
- Browser tests cover Chat/Edit behavior, compact excerpts, inline notes, apply/reject notes preview, rewrite cleanup, highlight key chips, Generate Next, and Reference Translation preview-only behavior.
