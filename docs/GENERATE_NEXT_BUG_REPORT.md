# Generate Next P0 Bug Report

Date: 2026-05-08  
Branch: `fix/generate-next-p0`  
Base commit before fix: `d7c8189`

## Exact Reproduction Steps

1. Start a clean forced-mock dev server:
   ```bash
   npm install
   ESSAYCRAFT_FORCE_MOCK_AI=1 npm run dev
   ```
2. Open `http://localhost:3000`.
3. Clear browser localStorage.
4. In Module 1, enter:
   ```text
   Topic: AI study tools.

   Question: When do AI tools help students learn?
   ```
5. Click `Generate Module 2 from Module 1`.
6. Repeat from Module 3 with outline text and click `Generate Module 4 from Module 3`.
7. Open empty Module 4 and click `Generate Module 5 from Module 4`.

## Browser Evidence Before Fix

- Screenshot captured: `docs/generate-next-repro-before-fix.png`
- Post-fix success screenshot captured: `docs/generate-next-after-fix.png`
- Button disabled before click: `false` for Module 1 -> 2.
- Click handler fired: yes; a capture listener observed one Generate button click.
- API call made: yes for non-empty Module 1 -> 2.
- Browser console errors: none during the successful clean reproduction; only the React DevTools info message.
- Server logs: `/api/generate-next` returned HTTP 200 in forced mock mode.

## Request Payload Observed

```json
{
  "topic": "How can we strike a healthier social media balance?",
  "sourceModuleNumber": 1,
  "sourceTitle": "Topic & Question",
  "sourceText": "Topic: How can we strike a healthier social media balance?\n\nResearch question: ...",
  "sourceAnnotations": [],
  "sourcePatches": [],
  "sourceSources": []
}
```

## Response Payload Observed

The route returned HTTP 200 with:

```json
{
  "moduleNumber": 2,
  "title": "Topic & Question -> Research & Evidence",
  "text": "Refined question: ...\n\nWorking thesis: ...",
  "annotations": [],
  "sources": [],
  "globalFeedback": ["Mock generated Module 2 from Module 1."],
  "warnings": ["Mock mode did not verify any source metadata..."]
}
```

## State Before Click

- `currentModule`: `1`
- Module 1 text length: `369`
- Module 2 text length: `677`
- Module 2 snapshots: `0`

## State After Click

- `currentModule`: `2`
- Module 2 text length: `957`
- Module 2 snapshots: `1`
- Editor showed Module 2 generated text with blank lines.

## Root Cause

The React click handler was wired in the happy path, but Generate Next had several product-blocking silent-failure paths that made the action appear to do nothing or produce unrelated output:

1. Empty source modules were allowed to call `/api/generate-next`, so an empty Module 4 could generate fallback Module 5 content instead of telling the student what to fix.
2. Provider fallback warnings were returned but not surfaced prominently in the UI.
3. Generated response text could be empty and still pass schema/client checks.
4. Mock Module 1 -> 2 and Module 3 -> 4 generation relied too much on project title/default examples instead of the current module text, so output could look stale or unrelated to the student's edit.
5. Target snapshot happened before the API call; if a user switched modules during an in-flight request, target edits could be overwritten without a fresh snapshot.

## Fix Summary

- Added client-side empty-source guard with the exact friendly message: `Add content to Module N before generating Module N+1.`
- Added server-side empty-source rejection for `/api/generate-next`.
- Added shared response validation with non-empty generated text and `providerMode`.
- Surfaced success, fallback warnings, errors, and retry in a visible `Last action` area.
- Changed Generate button text to explicit `Generate Module N+1 from Module N`, with loading text while running and final-state text for Module 6.
- Snapshots target module immediately before overwrite in the same immutable state update that applies generated content.
- Prevented module switching while generation is in progress.
- Preserved user-supplied source cards and stopped accepting model-mutated source metadata.
- Updated mock generation to derive topic/subject from current source text and preserve paragraph breaks.
- Added browser regression tests for Module 1 -> 2, Module 3 -> 4, empty source guard, and API schema smoke.

## Post-Fix Verification

- Module 1 -> 2 browser flow: passed. The click visibly switches to Module 2, writes generated text, preserves paragraph breaks, snapshots Module 2, and shows `Module 2 generated and opened. Previous Module 2 saved as a snapshot.`
- Module 3 -> 4 browser flow: passed. The click visibly switches to Module 4 and produces multiple draft paragraphs.
- Empty Module 4 -> 5 browser flow: passed. No API request is needed; the app stays on Module 4 and shows `Add content to Module 4 before generating Module 5.`
- API schema smoke: passed. `/api/generate-next` returns HTTP 200 with non-empty text, valid annotations, arrays, and `providerMode: "mock"` in forced mock mode.
