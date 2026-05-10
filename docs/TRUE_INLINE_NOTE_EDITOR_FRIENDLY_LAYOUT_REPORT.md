# True Inline Note Editor-Friendly Layout Report

## Scope

This pass moved EssayCraft closer to a friendly document editor. The priority was to make revision notes behave like temporary inline text in the document flow while keeping canonical module text clean.

## Inline Notes

- The editor now builds a display buffer that interleaves canonical essay text with temporary `[Note: ...]` text.
- The display buffer occupies normal textarea layout space, so notes wrap with the document instead of floating over the essay.
- `module.text` remains essay-only canonical text.
- Notes remain stored separately in `module.patches`.
- Normal HTML/rich essay exports exclude notes.
- Full project JSON includes notes for recovery and continued editing.
- Clicking a note opens an inline note editor at the note location. The editor supports save, cancel, and delete.

## Apply Notes & Refresh

- When unresolved notes exist, `Apply Notes & Refresh` sends current module text plus notes to `/api/refresh`.
- The route returns a revision preview; it does not overwrite text automatically.
- Accept snapshots first, applies revised text, refreshes annotations, resolves notes, and enables undo.
- Reject keeps both the current text and visible notes.
- Mock revision now handles broader Chinese instructions, including title expansion, research-question naturalness, academic wording, shorter/longer instructions, and English cleanup.
- A dedicated open-notes prompt contract was added for real-provider refresh calls so note application is treated as a revision-preview task rather than label-only refresh.

## Edit Panel

- Edit mode stays compact with one instruction box and four actions: Rewrite, Academic, Translate, Explain.
- Rewrite and Academic produce Accept/Reject/Copy replacement previews.
- Translate and Explain remain read-only with Copy/Dismiss only.
- The Academic button now has blue emphasis while Translate and Explain remain secondary.
- Normal UI hides provider/debug/confidence details.

## Translation

- Selected-text translation remains scoped to the active/selected text.
- Translation previews are read-only and do not snapshot or mutate the document.
- Fallback text avoids provider/debug wording and source/citation commentary.

## Highlight And Layout

- Highlight strokes were tuned to thinner marker-style bands with lower opacity.
- Stale, whitespace-only, and out-of-range annotations remain ignored.
- Left module rail was cleaned up with stable icons, readable text, and the highlight key integrated in the lower rail.
- Next.js dev indicator remains hidden with `devIndicators: false`.

## Screenshots

- `docs/final-inline-note-flow.png`
- `docs/final-inline-note-editing.png`
- `docs/final-apply-notes-research-question.png`
- `docs/final-apply-notes-topic.png`
- `docs/final-edit-panel-buttons.png`
- `docs/final-translation-clean.png`
- `docs/final-highlight-thinner.png`
- `docs/final-left-rail-balanced.png`
- `docs/final-module2-layout.png`
- `docs/final-bottom-actions.png`

## Validation Notes

The full validation sequence passed after clearing `.next` before the production build. Running runtime smoke and production build concurrently can corrupt the `.next` artifact and cause a transient `/_document` page lookup failure; build passes when run alone after clearing `.next`.

## Remaining Limitations

- The editor still uses a textarea-driven model with a derived display buffer, not a full rich-text editor. This preserves stable typing, selection, JSON/export semantics, and paragraph behavior.
- Editing directly through the visible note text is supported through parsing, but complex multi-note editing is intentionally basic.
- Real source verification/search remains manual and source-card based.
- Real provider output can still vary; deterministic mock behavior is kept for reliable demos.
