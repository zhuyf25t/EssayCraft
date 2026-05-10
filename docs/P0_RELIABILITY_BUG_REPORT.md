# P0 Reliability Bug Report

Date: 2026-05-10
Branch: `fix/p0-reliability-editor-refresh-assistant`

## Reproduction Before Fix

1. Open the app in mock/fallback mode.
2. In Module 1, place the caret after the Topic line.
3. Press Ctrl/Cmd+Enter and type: `根据 project title 把这个标题写得更准确一点`.
4. The note input could be wiped or lose caret position during a React re-render, especially if Refresh ran while the note editor was open.
5. Paste a full essay into Module 6 and click Refresh Highlighting.
6. Some fallback/provider labels could make broad prose appear as Citation, making final-review highlighting untrustworthy.
7. Select a sentence, type `你评价一下这句话。用中文。`, and click Analyze quickly.
8. The request could miss the latest instruction text and return generic or English commentary.

## Root Causes

- Inline note input was embedded inside a re-rendered `contentEditable` document. The editor rebuilds DOM from canonical text, annotations, and patches; the open note editor needed to preserve its draft value and caret before each rebuild.
- Fallback labels included `citation` in the normal round-robin label sequence, so ordinary paragraphs could become Citation without a source signal. Provider labels were also trusted after exact-range validation even when Citation dominated the essay.
- Edit-mode actions read the React instruction state during the button click. In fast interactions, the textarea DOM value could be newer than the committed state.
- Fast Refresh full reloads were reproduced during overlapping Playwright/dev-server sessions. After stopping stale repo Node processes and clearing `.next`, no browser console errors were captured during the P0 manual scenario.

## Fix Summary

- Preserved inline note draft text and caret across editor DOM rebuilds; note text remains stored only in `module.patches`.
- Added refresh validation that rebalances overbroad Citation labels, falls back when provider labels are invalid/empty, and reruns safer fallback when Module 6 lacks useful label variety.
- Removed Citation from fallback label rotation and reserved Citation for citation/reference signals.
- Made Analyze/Rewrite button handlers read the current textarea DOM value before dispatching.
- Strengthened project-title-aware rewrite and note-driven refresh fallback so Chinese instructions produce changed text using `projectTitle`.

## Manual Verification After Fix

- `Chinese note input persists and Project Title drives Apply Notes` passed in Playwright.
- `inline note draft keeps caret through refresh rerender` passed in Playwright.
- `Module 6 refresh shows a visible final review checklist` passed in Playwright.
- `Analyze uses instruction language and is read-only` passed in Playwright.
- `rewrite follows English and Chinese length instructions without meta text` passed in Playwright.
- Browser screenshot run captured no console errors in `docs/p0-console-errors.txt`.

## Screenshots

- `docs/p0-note-typing-persists.png`
- `docs/p0-note-clean-module-text.png`
- `docs/p0-refresh-module6-mixed-labels.png`
- `docs/p0-refresh-module6-review-card.png`
- `docs/p0-analyze-chinese.png`
- `docs/p0-explain-specific-highlight.png`
- `docs/p0-rewrite-project-title.png`
- `docs/p0-runtime-clean.png`
