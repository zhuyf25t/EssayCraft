# Annotation, Chat, and Edit Polish Report

## Scope

This pass focused on reliability and clarity in the existing workspace. It did not rebuild the editor kernel or change the module generation prompts.

## Refresh and Highlighting

- Refresh now uses sentence-level and short rhetorical-unit annotation ranges instead of broad paragraph blocks.
- Citation labels are limited to citation/source cues such as in-text citations, `According to...`, URLs/DOIs, reference-list lines, and explicit citation markers.
- Long fallback annotation ranges are split unless they represent an intentional reference-like unit.
- Module 6 refresh continues to show the Final Review checklist while also producing mixed labels for a full essay.

## Chat

- Chat responses now use project title, module number/title, current clean module text, selected context, relevant notes, and recent user message.
- Chat answers the actual question instead of returning a fixed capability template.
- Chat follows Chinese when the user asks in Chinese or asks for Chinese.
- Chat key behavior: Enter sends, Ctrl/Cmd+Enter sends, and Shift+Enter inserts a newline.

## Edit Actions

- Edit mode keeps five compact actions: Rewrite, Academic, Analyze, Translate, and Explain.
- Rewrite and Academic are equal blue modification actions with Accept / Reject / Copy previews.
- Analyze, Translate, and Explain are secondary read-only actions with Copy / Dismiss behavior.
- Explain is only enabled for an active highlighted sentence/range and explains the actual text and label.
- Analyze uses the instruction box and can answer in Chinese.

## Selection With Notes

- When a selected range contains inline notes, the clean selected text excludes note text.
- Notes inside the selection are collected separately and sent as instructions to assist requests.
- The Edit context shows a note count, but the preview does not mix note text into the essay text.
- Accepting a rewrite for a selection resolves included notes; rejecting keeps text and notes unchanged.

## Note Scroll Stability

- The editor now restores internal scroll position after inline-note save/cancel and editor-content rerender.
- Note save and Escape no longer jump the editor viewport back to the top in tested workflows.

## Screenshots Created

- `docs/polish-sentence-level-highlights.png`
- `docs/polish-module6-mixed-labels.png`
- `docs/polish-chat-chinese-contextual.png`
- `docs/polish-chat-enter-send.png`
- `docs/polish-edit-buttons-clean.png`
- `docs/polish-analyze-readonly.png`
- `docs/polish-explain-specific.png`
- `docs/polish-selection-with-notes.png`
- `docs/polish-note-save-no-scroll-jump.png`

## Remaining Limitations

- Chat remains deterministic in forced mock mode, so it is useful for demo/testing but less nuanced than a reliable real provider response.
- Inline note anchoring is stable in current tested flows, but more adversarial rich-text edits across multiple note tokens should stay in the regression suite.
- A collapsed AI diagnostics section remains in Export for debugging provider configuration; it is not shown in the writing surface.
