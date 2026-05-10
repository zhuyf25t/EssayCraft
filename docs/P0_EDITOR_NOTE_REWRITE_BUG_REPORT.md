# P0 Editor Note Rewrite Bug Report

## Reproduction Before Fix

Manual path:

1. Open Module 1 in mock/fallback mode.
2. Place the caret after the topic line.
3. Press Ctrl/Cmd+Enter.
4. Type `根据我的 title 重写这个 topic`.
5. The inline note input could be rebuilt while typing, causing the draft text to disappear or the note editor to close unexpectedly.
6. Project-title rewrite requests such as `可以把问题写得更长一点，并且结合 project title` often produced generic or unchanged output because the assistant fallback did not receive/use `projectTitle`.

## Root Cause

- The custom contenteditable editor rebuilt its editable DOM with `root.replaceChildren()` whenever parent state changed. The inline note textarea was recreated from `initialValue`, so unsaved note text was lost during unrelated selection/status/annotation renders.
- `selectionchange` ignored only raw textarea focus, not the whole inline note editor, so focus churn inside the note editor could update selection state and trigger a rebuild.
- Assistant and refresh request schemas did not carry `projectTitle`; fallback rewrite logic used only selected text and instruction, so Chinese title-aware instructions could become generic no-op previews.

## Fix Approach

- Kept the custom editor; TipTap/ProseMirror was not introduced.
- Added a note-draft ref keyed by note/range so unsaved note text survives editor DOM rebuilds.
- Ignored selection syncing while focus is inside `[data-inline-note-editor]`.
- Added `projectTitle` to assist/refresh request types, schemas, prompts, and client payloads.
- Added deterministic fallback rewrite helpers that understand Chinese instructions and use Project Title for rewrite and note-driven refresh.
- Kept module text protection through the note kernel; notes remain metadata in `module.patches`.

## Manual Verification After Fix

- Ctrl/Cmd+Enter opens the inline note editor.
- Typing `根据我的 title 重写这个 topic` remains visible after a short wait and after note save/reopen.
- `module.text` does not contain the Chinese note, `NOTE`, patch ids, UUID markers, `[Note:`, or `[object Object]`.
- Apply Notes & Refresh previews a Project Title-aware topic revision before changing text.
- Accept snapshots first, applies the clean revised text, resolves/removes the visible note, and enables undo.
- Rewrite with `可以把问题写得更长一点，并且结合 project title` returns a longer Project Title-aware research question.

## Remaining Limitations

- The editor is still a lightweight custom contenteditable token editor, not a full ProseMirror document model.
- Open-note persistence across a full reload remains constrained by the current Playwright setup, which clears localStorage on navigation during tests.
- The old refresh-route fallback implementation remains in the file as disabled legacy comparison code until the next cleanup pass.
