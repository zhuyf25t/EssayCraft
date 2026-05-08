# EssayCraft Smooth Editor UX Spec

## Goal

The editor must feel like a normal text editor, while still rendering rhetorical-function highlights.

## Required architecture

Prefer a textarea + highlight-backdrop:

```text
┌ editor shell ┐
│ backdrop layer with colored spans  ← not interactive
│ textarea with transparent-ish background / normal caret  ← source of truth
└──────────────┘
```

The canonical text is a single string. Annotations are ranges over that string.

Do not insert patch text into the main document. Patches are metadata anchored to a sentence or selection.

## Keyboard behavior

- Normal typing/deleting/paste/undo/redo should work.
- `Ctrl+Enter` / `Cmd+Enter`: open patch for current sentence/selection.
- If patch is open, `Ctrl+Enter` / `Cmd+Enter`: save and close patch.
- `Shift+Enter` inside patch: newline.
- `Esc` inside patch: cancel.

## Patch behavior

- Placeholder: `Tell the AI what to fix here...`
- Patch anchors: `anchorStart`, `anchorEnd`, `anchorQuote`.
- If cursor enters a sentence with a patch, expand/show patch.
- If cursor leaves, collapse patch into a marker.
- Patches should be included in `/api/refresh`, `/api/generate-next`, and `/api/assist` requests.

## Refresh behavior

Refresh sends the whole current module text and patches. AI returns annotations only. Text must remain byte-for-byte identical unless the user explicitly accepts a rewrite from AI Assistant.
