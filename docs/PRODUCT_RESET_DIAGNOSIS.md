# EssayCraft Product Reset Diagnosis

Date: 2026-05-08
Branch: feat/product-reset-polish

## 1. Current layout problems

The current UI is feature-complete but not shaped like the intended one-screen writing workspace. The root page uses minimum-height layouts and page padding, so the browser document grows and the whole page scrolls. The bottom Highlight Key is sticky and overlays working content instead of taking reserved footer space inside the app shell. The top chrome is also too tall: header, progress, toolbar, generate row, and last-action status all consume vertical space before the editor.

## 2. Current content-generation problems

The Module 2 -> Module 3 fallback generator ignores the student's actual argument branches and evidence needs. It emits generic outline text such as "Present the first reason" and "State the essay's arguable position," which makes the product feel like a template instead of a writing-process assistant. Prompt mirrors also need stronger contracts requiring branch-specific grounding, source status, and [citation needed] markers when evidence is missing.

## 3. Current citation/source problems

Source handling is technically present but confusing. Module 2 needs to feel like a research source-card ledger, while Module 5 needs to feel like a citation/reference check. Placeholder source needs are counted too much like real sources, "verified" language can imply app verification, and the workbench does not clearly explain the two halves of citation work: an in-text citation plus a reference-list entry built only from user-provided metadata.

## 4. Current Translate problems

The mock Translate route returns an English wrapper and the original English text for English -> Chinese, so the user sees no visible Chinese output. The modal also lacks Auto-detect -> Simplified Chinese and does not surface provider mode. Translation preview/apply semantics are correct in shape, but the result must clearly show Chinese characters in mock mode and preserve paragraph breaks.

## 5. Current mismatch with reference mockups

The visual target shows a fixed paper-like editor with a left module pipeline, compact top progress, right helper panel, and visible bottom highlight key. The current implementation looks more like a scrolling dashboard: duplicated EssayCraft branding, too many equal-weight buttons, crowded right rail forms, and an editor that is squeezed by surrounding chrome. The central writing canvas should be dominant.

## 6. Prioritized fix plan

1. Convert the page into a fixed 100vh app shell: sidebar, compact top rows, non-scrolling workspace, central editor as the primary scroll surface, and reserved Highlight Key footer.
2. Add stable test selectors and Playwright coverage for no global page scroll, editor-only scrolling, and visible Highlight Key.
3. Rework Module 2 -> Module 3 mock/prompt behavior so it parses argument branches, evidence needs, thesis/counterargument, preserves the student's topic, and outputs a coherent paragraph-based outline with [source needed] when no source card exists.
4. Clarify Source Workbench language and structure: source needs vs real source cards, CARS checkboxes, student-supplied/student-checked copy, insert citation from source cards only, and reference preview from source cards only.
5. Fix Translate modal/API so English -> Chinese and Auto-detect -> Chinese show visible Simplified Chinese in mock mode, preview before apply, and snapshot before replacing text.
6. Reduce toolbar crowding and align status semantics across sidebar/progress without adding more surface area.
