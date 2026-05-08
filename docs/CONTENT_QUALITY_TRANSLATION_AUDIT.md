# Content Quality and Translation Audit

Date: 2026-05-08  
Branch: `feat/content-quality-translation-pass`

## Current State

EssayCraft runs and the Generate Next workflow is functional, but the content contract is still too weak in the deterministic/mock path and can produce output that feels like a template instead of an academic writing workflow.

## Defects Being Fixed

1. Module 1 -> Module 2 currently treats research planning as citation failure too early. Module 2 should describe source needs, search keywords, and CARS checks without filling the plan with red citation-gap language.
2. Module 2 -> Module 3 can still produce generic or awkward outline prose, including grammar such as `Topic. matters`. The outline must preserve the student's thesis and argument branches.
3. Module 3 -> Module 4 is the highest-risk defect. The fallback generator drafts about the outline itself, using phrases such as `the strongest body paragraph should` and `The student should`, instead of converting the outline into real essay paragraphs.
4. Fallback annotation labels are sentence-sequence based and misleading for structured module text. Research questions can be labeled as evidence, thesis-map reasons can drift into counterargument/citation labels, and source-planning metadata can become red issues.
5. Citation/source semantics are too noisy. Module 2 and Module 3 source needs are planning items; Module 4 and Module 5 citation gaps are draft/source-integrity problems.
6. Translate still offers `Apply translation`, snapshots the module, and can replace the editor text. For this pass, Translate must be preview-only. Applying translated/revised text belongs in the AI Assistant preview/apply workflow.
7. Mock English -> Simplified Chinese translation is partially mojibake and can return English content with a label instead of readable Chinese.

## Fix Plan

1. Rebuild deterministic Module 1 -> 2, 2 -> 3, and 3 -> 4 generation around explicit academic workflow contracts.
2. Parse Module 1 thesis-map and Module 2 branches so generated content carries the student's topic, research question, thesis, and reasons forward.
3. Convert Module 3 outlines into paragraph prose by stripping outline labels and using them as structure, not essay content.
4. Replace fallback label guessing with structure-aware rules for course-module headings and markers.
5. Extend citation audit data to separate source needs from citation gaps, and update the Source Workbench copy/metrics.
6. Make Translate modal preview-only: Create Preview, Copy translation, Close. No editor mutation and no snapshot creation.
7. Route assistant quick-action translation through the assistant preview path, where Apply still snapshots explicitly.
8. Add unit and browser regression tests for workflow output quality, annotation labels, citation semantics, Translate preview-only behavior, homepage rendering, and Generate Next.

## Acceptance Evidence Required

- Module 3 -> Module 4 produces real draft paragraphs about the student's topic.
- Generated Module 4 does not include outline-template phrases unless the user supplied them as prose.
- Module 2 source needs do not appear as citation gaps.
- Translate preview displays Simplified Chinese characters and leaves module text/snapshots unchanged.
- Existing Generate Next and homepage runtime checks continue to pass.
