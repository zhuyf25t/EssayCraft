# Copilot Interaction Simplification Report

Date: 2026-05-09

## Scope

This pass made EssayCraft feel more like a focused essay copilot instead of a collection of buttons. It did not add source search, a database, model routing, or a deep module-prompt rewrite.

## Toolbar And Status

- Removed the visible `More tools` button from the primary toolbar.
- Removed the large full-width Last Action banner by default.
- Kept only the core workflow actions visible: Back, Generate/Finalize, Refresh Highlighting, and a compact status pill.
- Provider details and retry information now live in a small `Details` popover when needed.
- Snapshot, clear, export, JSON, import, Reference Translation, and Reset Demo now live in the right-side tabs.

## Assistant Chat Mode

The Assistant tab is now an `Essay Copilot` with two modes.

`Chat about module` is for module-level questions. It works without selected text and answers about the current module's thesis, structure, evidence/source gaps, clarity, and next step. Chat responses are reference-only and do not modify the document.

## Edit Selection Mode

`Edit selection` activates when the user selects text or clicks inside a sentence. It shows:

- selected range or active sentence
- range offsets
- active label when present
- patch count

The user can give a custom edit instruction or use focused actions: Rewrite, Make more academic, Strengthen analysis, Translate selected text, Explain highlight, Relabel highlight, and Add patch note. Text-changing actions return a preview card first. Apply snapshots first, checks the original range, and changes only that range.

## Sentence Activation

Clicking inside the editor activates the sentence under the cursor. The active sentence receives a subtle blue outline in the highlight backdrop, and the Copilot shows the active sentence in Edit mode. Mouse text selection overrides sentence activation.

## Patch Markers

Patch notes still anchor to selected text or the active sentence with Ctrl/Cmd+Enter. Saved patches now have:

- an amber underline on patched text
- a small inline `msg` marker
- a clickable right-margin patch marker
- a Patch notes list with Jump, Edit, Resolve/Reopen, and Delete

Clicking a margin marker opens the existing patch note for editing.

## Highlight Inspector

The Edit mode includes a compact highlight inspector. It shows label name, color, confidence, provider note, excerpt, and comment. `Explain highlight` targets the active highlight. Relabel uses a dropdown of EssayCraft labels and saves a snapshot before updating annotation metadata.

## Reference Translation

Reference Translation remains preview-only and was removed from the primary toolbar. It is available from the Export tab. It never mutates module text and never creates snapshots. Selected-text translation that can be applied to the document remains in Assistant Edit mode.

## DeepSeek MVP Model Settings

The app now documents:

```text
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-pro
```

Assistant, refresh, and translation already use the fast model path with a short timeout. Generate Next can still use the configured general model.

## Screenshots

- `docs/copilot-pass-chat-mode.png`
- `docs/copilot-pass-edit-mode-selection.png`
- `docs/copilot-pass-preview-apply.png`
- `docs/copilot-pass-sentence-active.png`
- `docs/copilot-pass-patch-marker.png`
- `docs/copilot-pass-highlight-inspector.png`
- `docs/copilot-pass-export-tab-json.png`
- `docs/copilot-pass-compact-toolbar.png`

## Remaining Limitations

- Patch markers are practical right-margin markers, not a fully position-accurate comment gutter.
- Relabeling is snapshot-backed but does not provide a dedicated undo button beyond snapshot restore.
- Provider fallback remains deterministic and local for testing.
- Source search and source verification remain manual-only by design.
