# EssayCraft QA Experience Report

Date: 2026-05-08  
Branch: `feat/essaycraft-autonomous-evolution`

## 1. What Currently Works

- App starts locally and returns HTTP 200 at `http://localhost:3000`.
- The editor is a textarea with a synchronized highlight backdrop, so typing, deletion, paste, selection, and Enter behavior stay native.
- Canonical module text is plain text. Paragraph breaks are stored and exported as `\n\n`.
- Six modules save independently through localStorage-backed project state.
- Refresh Highlighting updates annotations and feedback without rewriting the module text.
- Generate Next snapshots the target module before overwrite and uses the typed transition prompt registry.
- Patch notes open with Ctrl/Cmd+Enter, save with Ctrl/Cmd+Enter inside the patch box, and leave essay text untouched.
- AI Assistant, Translate, snapshots, Clear Current Module, JSON import/export, HTML export, finish modal, and manual source cards are present.
- Mock mode remains usable without a DeepSeek key, and `ESSAYCRAFT_FORCE_MOCK_AI=1` forces deterministic local demos.

## 2. Top UX/Product Problems Found In Audit

1. The initial toolbar was crowded and the Generate action was not visually dominant enough.
2. Generated text cleanup was scattered across route logic instead of one tested formatting utility.
3. AI-returned source cards could be accepted, which risks invented metadata.
4. Manual source cards lacked DOI, URL, publisher, container, reference preview, and Insert Citation actions.
5. Import JSON replaced the project too directly and needed stricter validation plus backup-before-replace.
6. Translation of selected text needed safer scoping and annotation preservation.
7. There was no automated test script beyond typecheck/lint/build.

## 3. Formatting Problems

- Paragraphs were generally preserved in the editor, but generated text could still carry code fences, HTML tags, escaped `\\n`, or one-block draft output.
- Module 4 output needed stronger introduction/body/conclusion paragraph separation.
- Module 5 needed to preserve the full draft before appending a citation audit instead of truncating the source text.
- These were addressed with `src/lib/textFormat.ts`, API route cleanup, and Vitest coverage.

## 4. AI Response Reliability Problems

- DeepSeek remains server-side only, but a configured unreachable key can still create a timeout before fallback.
- API routes now validate exact annotation ranges and drop unsafe AI annotations.
- Generate Next no longer trusts AI-created sources unless they match user-supplied source IDs.
- `ESSAYCRAFT_FORCE_MOCK_AI=1` was added for deterministic demos and E2E tests.
- Remaining risk: provider timeout behavior is functional but still slower than pure mock mode when a bad key/base URL is configured.

## 5. Citation/Source Gaps

- Manual source cards are now clearer and more editable.
- Source cards now support authors, year, source type, container title, publisher, DOI, URL, credibility notes, user notes, user-checked status, in-text preview, reference preview, and Insert Citation.
- Evidence-like sentences and `[citation needed]` markers are surfaced in a deterministic citation audit.
- Automatic source search and verification are still not implemented. The UI explicitly says source cards are manual and not externally verified.

## 6. Export/Import Problems

- JSON export includes schema version, six independent module documents, annotations, patches, snapshots, sources, assistant history, and timestamps.
- Import now requires schema version 1 and all six module text fields.
- Before replacing the current project, import asks for confirmation and downloads a backup JSON.
- Invalid JSON surfaces a friendly status message.
- HTML export preserves paragraphs and highlights; Module 6 opens the finish modal first.

## 7. Visual Differences From Reference Mockups

- The current layout now follows the reference more closely: left module pipeline, top progress tracker, central editor, right assistant/snapshots/sources, pastel highlights, crayon-style EssayCraft title, and bottom Highlight Key.
- The utility toolbar is still more button-heavy than the mockup, but Generate is now separated as a workflow strip.
- The Highlight Key remains sticky; full-page screenshots can show it stitched over content, while normal viewport behavior keeps it visible at the bottom.

## 8. Browser Smoke Evidence

- Initial full-page screenshot: `docs/qa-screenshot-dashboard.png`
- Polish full-page screenshot: `docs/qa-screenshot-polish-pass.png`
- Polish viewport screenshot: `docs/qa-screenshot-viewport.png`
- Playwright E2E smoke covers paragraph editing, patch creation, manual source card entry, Insert Citation, and mock Generate Next paragraph preservation.

## 9. Self-Evolution Updates

Loop 1 - Paragraph and AI hardening:
- Added `src/lib/textFormat.ts`.
- Cleaned generated text in Generate Next and Translate routes.
- Added exact annotation validation and deterministic IDs.
- Added tests for code fences, escaped newlines, paragraphs, project import, snapshots, and citation audit.

Loop 2 - Citation, import, and module safety:
- Rebuilt the source workbench around manual editable source cards.
- Added Insert Citation and Mark Selection Needs Citation.
- Added deterministic citation audit and safer Module 4 -> Module 5 mock generation.
- Hardened JSON import with schema validation and backup-before-replace.
- Added module sidebar statuses: empty, draft, has issues, done.

Loop 3 - Product polish and browser validation:
- Reduced toolbar clutter and added a prominent workflow Generate strip.
- Added Playwright E2E tests and forced mock AI mode for deterministic browser runs.
- Fixed selected translation scoping and preserved unaffected annotations when applying selected translation.
- Made the Module 6 finish image unoptimized so it loads directly from `public/assets`.
- Captured updated screenshots.

## 10. Validation Results

- `npm install`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 10 Vitest tests.
- `npm run smoke`: passed, 10 Vitest tests under `src/lib`.
- `npm run test:e2e`: passed, 2 Playwright tests.
- `npm run build`: passed.

## 11. Remaining Limitations

- EssayCraft does not verify sources online and must not be treated as a citation search engine.
- Provider timeout fallback is reliable but can be slow with a configured unreachable DeepSeek endpoint.
- Patch anchoring repairs simple edits by anchor quote, but complex rewrites can mark stale patches resolved instead of deeply re-anchoring them.
- The visual style is polished for a demo but not pixel-perfect against the supplied mockups.

## 12. Product Reset Update - 2026-05-08

- Layout: the app is now a fixed one-screen shell. The browser document no longer scrolls at desktop viewport; the editor textarea is the primary long-content scroll surface and the Highlight Key has reserved footer space.
- Content quality: Module 2 -> Module 3 parses argument branches, evidence-needed lines, source status, thesis, and counterargument before generating an outline. The fallback no longer emits generic `Present the first reason` outline filler when branch content exists.
- Topic consistency: reset demo data now keeps Project Title and Module 1 research question aligned. Browser tests also cover a custom `technology and humanity` topic through Module 2 and Module 3 to prevent fallback to the old social-media demo.
- Citation/source UX: Source Workbench now distinguishes manual source cards from source needs, exposes CARS checks, uses student-supplied/student-checked wording, and shows Module 5 citation/reference issue groups.
- Translate: mock English/auto -> Chinese translation now returns visible Simplified Chinese, previews before apply, and snapshots before replacing module text.
- Screenshots: `docs/product-reset-dashboard.png`, `docs/product-reset-module2-to3.png`, and `docs/product-reset-translate-cn.png`.

## 13. Content Quality and Translation Update - 2026-05-08

- Module 1 -> 2 now produces research/source-needs planning instead of treating every evidence need as a citation failure.
- Module 2 -> 3 now preserves the student's branch claims, source needs, research question, thesis, and counterargument in a concrete outline.
- Module 3 -> 4 now parses outline fields into real draft paragraphs and rejects meta-template phrases such as `The student should`, `Topic sentence:`, and `Evidence to use:`.
- Fallback highlighting is structure-aware for `Topic`, `Research question`, `Working thesis`, `Thesis map`, `Evidence to look for`, `Source status`, `Analysis purpose`, and conclusion/counterargument labels.
- Source Workbench now separates source needs from citation gaps. Module 2/3 planning needs are not displayed as draft citation failures.
- Translate is now preview-only. It can create and copy a Chinese preview, but it never mutates module text and never creates snapshots.
- Screenshots: `docs/content-quality-module2.png`, `docs/content-quality-module3.png`, `docs/content-quality-module4.png`, and `docs/translate-preview-only-cn.png`.
