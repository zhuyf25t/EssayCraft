# Visual Compaction and Translation Cleanup Report

## Scope

This ninth pass focused on visual compaction, Reference Translation cleanup, selected-text translation routing, and final demo flow stability. It did not add model routing, real source search, or deep prompt rewrites.

## Compact Progress Indicator

- Replaced the wide top module progress card row with a compact header indicator.
- The header now keeps the project title input, current module label, and six small module circles in one row.
- Completed modules show a small `ok` state, the current module uses the active blue circle, issue modules stay red, and future modules remain pale.
- The left sidebar remains the place for full module names and workflow context.
- The compact progress control keeps aria labels for module number, title, and status.

## Toolbar

- Kept the action strip to the core workflow actions:
  - Back to previous module
  - Generate next module / Finalize export
  - Refresh Highlighting
  - More tools
- Secondary actions remain inside More tools or the Export tab.
- The Generate button remains visually dominant and now has enough width for the full `Generate Module N+1 from Module N` label on desktop demo viewports.

## Reference Translation

- Reference Translation remains preview-only.
- It never modifies module text and never creates snapshots.
- The modal now uses the subtitle: `Preview-only reading aid. It never changes the original document.`
- The fallback Chinese translation no longer inserts commentary-style text into the translation body, including:
  - `中文参考翻译`
  - `这句话讨论了`
  - `这句话强调`
  - `核心论点是`
  - `本地参考翻译`
  - repeated `译文:` prefixes
- Provider/fallback warnings appear in a small muted status area outside the translation text.
- Fallback output preserves paragraph breaks and keeps `[citation needed]` / `[source needed]` markers intact.

## AI Assistant Selected-Text Translation

- The Assistant action is now `Translate selected text`.
- It is disabled until the user selects text.
- Selected-text translation creates an Assistant preview card first.
- The preview supports Copy, Apply to selection, and Dismiss.
- Applying snapshots the module first and uses the existing range-safety check.
- The global Reference Translation modal can send a copy-only translation preview to Assistant, but it does not write to the editor.

## Right Tabs and Highlight Key

- Right-side tabs remain: Assistant, Sources, Snapshots, Export.
- Assistant remains the default for Modules 1-4.
- Sources remains the Module 5 citation-workflow area.
- Export remains the Module 6 final workflow area.
- The bottom Highlight Key is now a calmer one-line strip with soft swatches and internal horizontal scrolling if needed.

## Screenshots

- `docs/visual-pass-module1-compact.png`
- `docs/visual-pass-module3-compact.png`
- `docs/visual-pass-module4-assistant.png`
- `docs/visual-pass-reference-translation-clean.png`
- `docs/visual-pass-sources-tab.png`
- `docs/visual-pass-module5-citation.png`
- `docs/visual-pass-module6-export.png`

## Remaining Limitations

- Fallback translation is still a deterministic demo approximation, not a professional translation engine.
- Unknown text can only receive a safe Chinese approximation until a provider is available.
- Source search and source verification are still intentionally manual-only.
- The visual direction is closer to the mockups, but it is not pixel-perfect.
