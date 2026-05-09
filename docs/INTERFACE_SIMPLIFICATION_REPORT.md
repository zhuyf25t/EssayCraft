# Interface Simplification Report

Date: 2026-05-09

## Scope

This pass focused on interface organization and demo workflow polish. It did not change model routing, add source search, or rebuild the app.

## Layout And Panels

The app remains a fixed one-screen workspace:

- Left module pipeline.
- Top project title, progress, and compact command row.
- Central editor as the primary writing surface.
- Right workspace with tabs: Assistant, Sources, Snapshots, Export.
- Fixed bottom Highlight Key.

The right panel now behaves like a deliberate workspace instead of a long stacked sidebar. Inactive tabs are hidden but remain mounted so unsent assistant text and source-card draft fields are not discarded by tab switches.

## Toolbar Simplification

The primary command row now exposes only the workflow-critical controls:

- Back to previous module.
- Generate Module N+1 from Module N, or Finalize / Export in Module 6.
- Refresh Highlighting.
- More tools.
- Compact status.

Secondary actions live in More tools:

- Save Snapshot.
- Clear Module.
- Copy Rich Text.
- Download HTML.
- Download JSON.
- Import JSON.
- Reference Translation.
- Reset Demo.

## Module 5 And Module 6

Module 5 defaults the right workspace to Sources and shows a citation checklist:

- In-text citations present?
- Reference list entries present?
- Each real source has both halves?
- Any `[citation needed]` markers?
- Any invented/placeholder citations?

Module 6 defaults to Export and shows a final review checklist:

- Content.
- Structure.
- Clarity.
- Style.
- Proofreading, formatting, citations.

Module 6 no longer presents a fake Generate Module 7 action. The primary button reads `Finalize / Export`.

## Stability

The editor scroll reset behavior from the previous pass is preserved. Opening tabs, More tools, Reference Translation, and Assistant previews does not reset editor scroll unless the module itself changes.

## Screenshots

- `docs/interface-pass-module1.png`
- `docs/interface-pass-module4-assistant.png`
- `docs/interface-pass-sources-tab.png`
- `docs/interface-pass-snapshots-tab.png`
- `docs/interface-pass-export-tab.png`
- `docs/interface-pass-reference-translation.png`
- `docs/interface-pass-module5-citation-check.png`
- `docs/interface-pass-module6-final-review.png`

## Remaining Limitations

- Visual style is closer to the mockups, but still more utilitarian than hand-drawn.
- Source search and source verification are not implemented.
- The Reference Translation fallback is a readable local preview, not a professional translation engine.
- The right panel is tabbed, but individual tabs can still become dense with long source lists or many snapshots.

No API keys or secrets should be committed. Do not use `NEXT_PUBLIC_DEEPSEEK_API_KEY`.
