# Module Transition Prompts

Editable prompt registry lives in:

```text
src/lib/moduleTransitionPrompts.ts
```

This file documents the purpose and expected behavior of each Generate Next operation. Update both this document and the TypeScript registry when discussing changes with the instructor.

## Shared rules for every transition

- Return valid JSON only.
- Store content as canonical plain text with paragraph breaks as `\n\n`.
- Return annotation ranges with `start`/`end` offsets.
- Do not generate HTML or colored spans.
- Preserve the user's topic, stance, and voice where possible.
- Never invent citations or references.
- Use `[citation needed]` and `issue` labels for unsupported factual claims.
- Snapshot target module before overwrite.

## Module 1 → Module 2: Topic & Question to Research & Evidence

Purpose: convert topic, research question, and early thesis into a research plan.

Output should include:

- refined question
- working thesis/position
- 3–4 contributing argument branches
- evidence needed for each branch
- suggested source types
- possible search keywords
- CARS source-evaluation reminder: Credible, Accurate, Reasonable, Support
- missing-evidence warnings

Formatting: headings and bullets are acceptable.

## Module 2 → Module 3: Research & Evidence to Outline

Purpose: convert research/evidence notes into a structured essay outline.

Output should include:

- introduction plan: hook/importance, background, focus/scope, thesis, thesis map
- body paragraph plans: topic sentence, evidence, analysis, link back
- counterargument/rebuttal slot
- conclusion plan
- citation-needed warnings

Formatting: clean outline with headings and bullets.

## Module 3 → Module 4: Outline to Drafting

Purpose: convert outline into full academic draft.

Output should include:

- introduction paragraph
- body paragraphs
- counterargument/rebuttal paragraph if appropriate
- conclusion or conclusion placeholder
- signal devices/metadiscourse
- hedging where appropriate
- `[citation needed]` for unsupported factual claims

Formatting: paragraph prose with blank lines between paragraphs. Do not glue all sentences into one block.

## Module 4 → Module 5: Drafting to Referencing / Citation Check

Purpose: preserve draft and add citation/source-integrity review.

Output should include:

- preserved draft paragraphs as much as possible
- missing citation markers
- existing citation recognition
- source card/checklist section
- in-text citation and reference-list checks
- issue labels for unresolved citation problems

Formatting: draft paragraphs first, then a clearly separated checklist/workbench section.

## Module 5 → Module 6: Referencing / Citation Check to Final Review / Export

Purpose: create final review and export-ready content.

Output should include:

- final revised essay if safe
- editing checklist: content, structure, clarity, style
- proofreading checklist: spelling, grammar, punctuation, formatting, citations, references
- conclusion check: rephrased thesis, synthesis, significance/so-what, no major new evidence
- unresolved issues

Formatting: final essay paragraphs, then checklist sections.
