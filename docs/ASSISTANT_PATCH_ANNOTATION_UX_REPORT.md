# Assistant, Patch, And Annotation UX Report

Date: 2026-05-09

## Scope

This pass repaired the editing-assistance layer without changing model routing, source search, module-transition prompt strategy, or the compact fixed workspace layout.

## Assistant

The Assistant now works at two levels:

- With no selected text, the Ask box answers about the current module as a whole. The fallback response references the module text, structure, thesis, citation gaps, or paragraph shape instead of returning a generic capability message.
- With selected text, targeted actions become available. Rewrite, academic tone, strengthen analysis, translate selected text, and relabel selection all return a preview first.

Preview cards show the action type, original excerpt, proposed replacement or label change, explanation, provider mode, and warning text when the provider falls back to the local deterministic mock. Applying a text preview snapshots the current module first, verifies the selected range still matches the original excerpt, and then replaces only that range.

## Highlight Inspector

The Assistant tab now includes an annotation inspector. Clicking or focusing a highlighted range activates the matching annotation and shows:

- label and color
- confidence
- highlighted text excerpt
- comment or explanation
- related active patch, when present
- actions to explain the highlight, relabel it, or add a patch note

If no highlight is active, the inspector tells the user to click a highlighted sentence or select text for targeted help.

## Patch Notes

Patch notes are now visible and manageable:

- Ctrl/Cmd+Enter in the editor opens a patch popover for the current selection or nearby sentence.
- The patch popover has an example-driven placeholder and supports Enter or Ctrl/Cmd+Enter to save, Shift+Enter for a newline, and Escape to cancel.
- Saved patches draw a subtle amber underline on the anchored text and a small inline `note` marker.
- The Patch notes list shows Patch 1, Patch 2, anchored excerpts, patch text, and status.
- Patch actions include Jump to text, Edit, Resolve/Open, and Delete.
- Text edits repair patch anchors when the original excerpt can be found. If not, the patch is kept and marked `Needs re-anchor`.

Refresh Highlighting includes patch notes in the mock payload. Obvious patch instructions such as "This is analysis, not evidence" can relabel the anchored range as analysis, while source-related patch requests create issue annotations without inventing sources.

## JSON Export Labels

The Export tab and More tools menu now say `Download full project JSON` and `Import full project JSON`. Helper text states that the file includes all six modules, annotations, patches, snapshots, sources, and assistant history. Import copy warns that it replaces the whole local project after backup.

## Screenshots

- `docs/assistant-pass-no-selection-help.png`
- `docs/assistant-pass-selected-text-actions.png`
- `docs/assistant-pass-preview-apply.png`
- `docs/assistant-pass-highlight-inspector.png`
- `docs/assistant-pass-patch-marker.png`
- `docs/assistant-pass-patch-list.png`
- `docs/assistant-pass-export-json-help.png`

## Remaining Limitations

- Patch markers are inline and subtle rather than a full document margin comment system.
- Active highlight selection is based on click or caret overlap, not a separate annotation list.
- Provider failures still rely on deterministic mock responses; source verification is intentionally not implemented.
- Range-safe assistant apply blocks stale previews instead of attempting complex merge conflict resolution.
