# EssayCraft Acceptance Criteria

## Product structure

- [ ] App is named EssayCraft.
- [ ] One-page workspace runs with Next.js + TypeScript + Tailwind.
- [ ] Left sidebar shows six modules.
- [ ] Top header shows project title/topic and Module N of 6.
- [ ] Top progress bar shows current module and completed modules.
- [ ] Right panel contains AI Assistant and snapshot/version area.
- [ ] Bottom Highlight Key is always visible.
- [ ] Visual style is simple, off-white, pastel, crayon/marker-inspired, close to reference images.

## Module workflow

- [ ] Each module has independent text/annotations/patches/snapshots/sources.
- [ ] Prev/Next switches modules without losing content.
- [ ] Generate Next uses current module to overwrite the next module.
- [ ] Target module is snapshotted before overwrite.
- [ ] User is shown a working/progress state during generation.
- [ ] Every Module N→N+1 transition uses its own editable prompt from `src/lib/moduleTransitionPrompts.ts`.
- [ ] Delete/Clear Current Module asks for confirmation, snapshots first, then clears only the current module.

## Editor and paragraphs

- [ ] Editor feels normal: arrows, selection, paste, delete, undo do not break.
- [ ] Paragraph breaks are preserved with `\n\n`.
- [ ] Generated Module 4 draft displays as real paragraphs, not one glued block.
- [ ] Module 2 and 3 may use headings/bullets, but they must still be readable and separated.
- [ ] Copy Rich Text preserves paragraph breaks and highlight colors where possible.
- [ ] Download HTML preserves paragraph breaks and highlight colors.
- [ ] JSON export/import preserves every module independently.

## Highlighting

- [ ] Refresh Highlighting sends the whole current module to AI.
- [ ] Refresh does not rewrite user text.
- [ ] Refresh updates annotations/comments/issues only.
- [ ] Labels include background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain.
- [ ] Highlight Key explains every label.
- [ ] `issue` labels are visually noticeable but not ugly.

## Patch UX

- [ ] Ctrl/Cmd+Enter opens patch for current sentence or selected range.
- [ ] Patch box has placeholder: `Tell the AI what to fix here...`.
- [ ] Ctrl/Cmd+Enter inside patch saves/closes.
- [ ] Shift+Enter inside patch inserts newline.
- [ ] Esc cancels patch.
- [ ] Patch notes are metadata, not inserted into essay text.
- [ ] Cursor entering patched range expands patch preview; cursor leaving collapses marker.

## AI Assistant

- [ ] Right assistant sees selected text and current module.
- [ ] Assistant quick actions include explain highlight, relabel, rewrite, make academic, strengthen analysis, citation check, translate.
- [ ] Assistant suggestions preview before applying.
- [ ] Applying a suggestion snapshots first.
- [ ] Assistant never invents citations.

## Citation/source workbench

- [ ] Module 5 identifies citation gaps.
- [ ] Evidence without source is marked `[citation needed]` and/or `issue`.
- [ ] Source cards can be manually added.
- [ ] App distinguishes supplied sources from missing/unverified sources.
- [ ] In-text citation and reference list are treated as two halves.
- [ ] No fake references are generated.

## Translate

- [ ] Translate is implemented after core commit.
- [ ] Translate supports selected text and current module.
- [ ] Translate supports English→Chinese and Chinese→English.
- [ ] Translate previews side-by-side and does not overwrite automatically.
- [ ] Translate modal is preview-only: create preview, copy translation, close.
- [ ] Translate modal never mutates module text and never creates snapshots.
- [ ] AI Assistant handles selected-text translation when the user wants preview/apply insertion.

## Export/final

- [ ] Module 6 Download HTML shows finish modal with photo if asset exists.
- [ ] Finish modal includes: `Inspired by John-Paul Grima's argumentative essay journey.`
- [ ] App does not identify people in the photo.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` pass.
- [ ] No API keys are committed.
