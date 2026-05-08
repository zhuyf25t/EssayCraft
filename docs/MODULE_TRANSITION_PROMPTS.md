# Module Transition Prompts

The typed prompt registry lives in:

```text
src/lib/moduleTransitionPrompts.ts
src/lib/promptRegistry.ts
```

Editable markdown mirrors live in:

```text
prompts/module-transitions/module-1-to-2.md
prompts/module-transitions/module-2-to-3.md
prompts/module-transitions/module-3-to-4.md
prompts/module-transitions/module-4-to-5.md
prompts/module-transitions/module-5-to-6.md
```

Update both the TypeScript registry and the markdown mirror when revising prompts with an instructor.

## Shared Rules For Every Transition

- Return valid JSON only.
- Store content as canonical plain text with paragraph breaks as `\n\n`.
- Return annotation ranges with `start` and `end` offsets that exactly match the returned text.
- Do not generate HTML or colored spans.
- Preserve the user's topic, stance, and voice where possible.
- Never invent citations, authors, years, titles, journals, DOIs, URLs, or reference entries.
- Use `[citation needed]`, `issue` labels, and source-card suggestions for unsupported factual claims.
- Snapshot the target module before overwrite.
- If the model is unsure, return a safe scaffold with clear placeholders instead of guessing.

## Module 1 To Module 2: Topic & Question To Research & Evidence

Purpose: convert topic, research question, thesis, and thesis map into a research/source-card plan.

Output should include:

- research plan for the student's actual topic/question,
- working thesis/position,
- three contributing argument branches or claims to investigate,
- evidence needed for each branch,
- possible source types,
- possible search keywords,
- source status for each branch,
- CARS source-evaluation reminder: Credible, Accurate, Reasonable, Supportive,
- missing-evidence warnings.

Formatting: headings and bullets are acceptable.

## Module 2 To Module 3: Research & Evidence To Outline

Purpose: convert research/evidence notes into a structured essay outline grounded in the student's actual argument branches and evidence needs.

Output should include:

- introduction plan: hook/importance, background, focus/scope, thesis, thesis map,
- body paragraph plans grounded in named Module 2 branches,
- each body paragraph: topic sentence, Evidence to use, analysis, link back,
- counterargument paragraph,
- conclusion plan,
- citation-needed warnings.

Formatting: clean outline with headings and bullets. Do not write Module 4 full draft prose.

Quality rule: do not output generic filler such as `Present the first reason` or `State the essay's arguable position` when Module 2 provides branch/thesis content.

## Module 3 To Module 4: Outline To Drafting

Purpose: convert outline into a full academic draft.

Output should include:

- introduction paragraph,
- body paragraphs,
- counterargument/rebuttal paragraph if appropriate,
- conclusion or conclusion placeholder,
- signal devices/metadiscourse,
- hedging where appropriate,
- `[citation needed]` for unsupported factual claims.

Formatting: paragraph prose with blank lines between paragraphs. Do not glue all sentences into one block.

## Module 4 To Module 5: Drafting To Referencing / Citation Check

Purpose: preserve the draft and add citation/source-integrity review.

Output should include:

- preserved draft paragraphs first,
- missing citation markers,
- existing citation recognition,
- source-card/checklist section,
- in-text citation and reference-list checks,
- issue labels for unresolved citation problems.

Formatting: draft paragraphs first, then a clearly separated checklist/workbench section.

## Module 5 To Module 6: Referencing / Citation Check To Final Review / Export

Purpose: create final review and export-ready content.

Output should include:

- final revised essay if safe,
- editing checklist: content, structure, clarity, style,
- proofreading checklist: spelling, grammar, punctuation, formatting, citations, references,
- conclusion check: rephrased thesis, synthesis, significance/so-what, no major new evidence,
- unresolved issues.

Formatting: final essay paragraphs, then checklist sections.
