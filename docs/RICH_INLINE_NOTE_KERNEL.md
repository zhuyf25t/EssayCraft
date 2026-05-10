# Rich Inline Note Kernel

This pass replaces the old sentinel-string note approach with a clean editor kernel.

## Representation

- `module.text` is always clean essay text.
- Inline notes are stored only in `module.patches`.
- The editor renders notes as non-editable inline DOM tokens with `data-inline-note-id` metadata.
- Note ids and internal anchors are never inserted into visible essay text.
- Normal rich text and HTML export read from `module.text`, so notes are excluded.
- Full project JSON includes notes separately in each module document.

## Serialization Guard

`src/lib/noteKernel.ts` strips old leaked sentinel blocks such as `NOTE:...`, raw patch ids, invisible separators, and `[object Object]` before text can be saved, refreshed, generated, or assisted.

The main editor serializes DOM back to:

- clean text, skipping `[data-inline-note-id]` and `[data-inline-note-editor]`
- patch metadata, keeping note text and clean-text anchors separately

## Apply Notes & Refresh

When open notes exist, Refresh becomes `Apply Notes & Refresh`.

The route receives clean text plus note metadata. It returns a revision preview first. Accept snapshots the module, applies the clean proposed text, refreshes annotations, resolves the applied notes, and adds undo. Reject leaves both text and notes unchanged.

If no API key is configured, or if the provider times out/returns invalid JSON, the route uses deterministic mock behavior. If a note asks for a clear change but the provider returns unchanged text, EssayCraft rejects that no-op and falls back to a mock revision. None of these fallback paths mutate `module.text` before the user accepts the preview.

If there are no open notes, `/api/refresh` remains annotation-only and preserves exact text.

## Editor Stability

The editor uses an uncontrolled `contenteditable` container with manual DOM rendering. React no longer reconciles editable `mark` and note-token children, which prevents `removeChild` crashes and keeps note ids out of the text buffer.

## Limitations

- This is a lightweight custom token editor, not TipTap/ProseMirror.
- Note tokens are non-editable chips; clicking a chip opens an inline textarea at the same flow position for editing.
- Complex edits around a note rely on anchor repair. If the anchor cannot be repaired, the note can be marked stale instead of being moved silently.
- Browser/IME behavior is guarded, but the native editing surface should keep receiving focused regression tests as the editor evolves.
