# Rich Inline Note Editor Polish Report

## Summary

This pass keeps EssayCraft as a stable textarea-first writing workspace while making notes behave like inline document tokens instead of floating labels. The editor now renders note instructions in the document flow, keeps canonical module text clean, and uses notes only as AI revision instructions for Apply Notes & Refresh.

## Editor Internals

- Kept the existing textarea/backdrop architecture to preserve normal typing, selection, IME behavior, paragraph breaks, and export semantics.
- Added a display-buffer layer that interleaves canonical essay text with generated note tokens.
- Note tokens use hidden patch-id sentinels internally, so ordinary student text such as `[Note: compare sources]` is preserved as essay text and is not treated as metadata.
- Note content remains stored in `module.patches`; `module.text` remains essay text only.

## Inline Notes

- `Ctrl/Cmd+Enter` opens an inline note editor at the selected range/caret anchor.
- Enter saves and collapses the note; Shift+Enter still works for multiline note editing where the textarea supports it; Esc cancels.
- Saved notes render as compact amber inline tokens near their anchor.
- Clicking a note reopens inline editing.
- The large persistent notes panel stays absent; the document is the primary note surface.

## Apply Notes & Refresh

- With unresolved notes, the bottom refresh action becomes `Apply Notes & Refresh`.
- The action sends current module text plus unresolved notes to the refresh route.
- The server/mock returns a revision preview instead of overwriting text.
- Accept snapshots first, applies revised text, refreshes annotations, resolves notes, and creates an undo entry.
- Reject leaves text and notes unchanged.
- Mock handling visibly revises common Chinese and English instructions, including longer titles, more research-like questions, shorter text, academic wording, and naturalness requests.

## Assistant Edit Actions

- Assistant remains simplified to Chat/Edit.
- Edit mode keeps four actions: Rewrite, Academic, Translate, Explain.
- Rewrite and Academic return Accept/Reject/Copy previews and snapshot before accepted changes.
- Academic now has blue emphasis like Rewrite.
- Translate and Explain remain read-only with Copy/Dismiss only.
- Explain works for a highlighted sentence, selected text, or active sentence.

## AI Fallback Diagnostics

- Interactive routes use the fast model by default.
- `ESSAYCRAFT_FAST_FALLBACK_MS` defaults to 2500ms in development if unset.
- Full module generation can use `ESSAYCRAFT_GENERATE_TIMEOUT_MS`.
- A collapsed AI diagnostics section lives in the Export tab. It is not shown in the main writing surface.
- Generate Next fallback warnings no longer expose raw provider errors to users.

## Screenshots

- `docs/rich-note-inline-token.png`
- `docs/rich-note-editing-in-place.png`
- `docs/rich-note-no-cursor-jump.png`
- `docs/rich-note-apply-refresh-preview.png`
- `docs/rich-note-after-accept.png`
- `docs/rich-edit-panel-simple.png`
- `docs/rich-explain-readonly.png`
- `docs/rich-translate-readonly.png`
- `docs/rich-left-rail-polish.png`
- `docs/rich-ai-diagnostics-export.png`

## Remaining Limitations

- The editor is still a textarea/display-buffer implementation, not a full contenteditable or ProseMirror editor. This keeps typing and export stable, but note tokens are not fully rich-text widgets.
- Long notes can still interrupt line rhythm; future polish should add a compact collapsed/expanded note token.
- Keyboard behavior directly inside a saved note token is intentionally conservative. Click the note to edit it.
- Mobile and narrow tablet layouts remain below final-product quality.
