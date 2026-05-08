# AGENTS.md — EssayCraft Autonomous Product Builder

Codex must read this file before doing any work in this repository.

## Product goal

Build **EssayCraft**, a polished, practical, stable AI-assisted academic essay workflow editor based on six course modules:

1. Topic & Question
2. Research & Evidence
3. Outline
4. Drafting
5. Referencing / Citation Check
6. Final Review / Conclusion / Export

EssayCraft is not a black-box essay generator. It is a writing-process workspace: user text is the source of truth; AI helps classify, generate, revise, translate, check citation gaps, explain structure, and guide the user through a module workflow.

## Autonomous operating rule

Do not stop after planning. Work as an expert product engineer until the acceptance criteria pass or an external blocker prevents progress.

When you think there are no remaining tasks, do not stop. Run the self-evolution loop:

1. Re-read `docs/ACCEPTANCE_CRITERIA.md`, `docs/SELF_EVOLUTION_PROTOCOL.md`, `docs/NIGHT_RUN_CHECKLIST.md`, `docs/VISUAL_TARGET.md`, and the reference images.
2. Run the app locally if possible.
3. Use the app like a real student: create topic, edit text, preserve paragraphs, patch with Ctrl/Cmd+Enter, refresh, generate next, restore, use assistant, use citation workbench, export, translate.
4. Find the weakest remaining product/UX/technical issue.
5. Implement the smallest robust improvement, or add it to an internal backlog and immediately pick the next most valuable task.
6. Validate with `npm run typecheck`, `npm run lint`, `npm run build`, and tests/smoke checks if available.
7. Repeat until the acceptance criteria pass.

Stop only when:

- all acceptance criteria pass,
- validation commands pass,
- manual smoke test passes,
- the app feels smooth and usable,
- no API key is committed,
- and the final summary is complete.

If a platform/time/permission/API blocker prevents full completion, commit the best working state and clearly report the blocker.

## Subagent rule

Use subagents if available. Explicitly spawn and wait for focused agents:

- `product_architect`
- `ux_editor_engineer`
- `ai_backend_engineer`
- `citation_source_architect`
- `qa_experience_tester`
- `visual_polish_designer`
- `docs_maintainer`

If custom subagents are unavailable, emulate these roles sequentially in the main thread. Subagents may explore and implement scoped changes, but the main Codex thread must consolidate, run final checks, review secrets, and commit.

## Git workflow

Start with git hygiene:

```bash
git status
git remote -v
git branch --show-current
git pull --rebase origin main || git pull --rebase origin master || true
git checkout -b feat/essaycraft-autonomous-evolution || git checkout feat/essaycraft-autonomous-evolution
```

Use milestone commits:

```bash
git add .
git commit -m "feat: build EssayCraft core module workflow" || true

git add .
git commit -m "feat: polish editor UX and progress workflow" || true

git add .
git commit -m "feat: add AI assistant and citation workbench" || true

git add .
git commit -m "feat: add JSON import export and module management" || true

git add .
git commit -m "feat: add bilingual translate workflow" || true

git add .
git commit -m "chore: harden EssayCraft autonomous product" || true
```

Push if allowed:

```bash
git push -u origin feat/essaycraft-autonomous-evolution || true
```

## UX principles

- The editor must feel smooth and normal.
- Preserve paragraph breaks. Do not collapse generated paragraphs into one block.
- Use canonical plain text with `\n\n` paragraph breaks plus separate annotation ranges.
- Prefer textarea + synchronized highlight backdrop, or a robust editor with equivalent behavior.
- Avoid fragile inline `contentEditable` spans if deletion, selection, IME, paste, or cursor movement break.
- `Ctrl+Enter` / `Cmd+Enter` opens a patch box for the current sentence/selection.
- If a patch box is open, `Ctrl+Enter` / `Cmd+Enter` saves and closes it.
- `Shift+Enter` inserts a newline in the patch box.
- `Esc` cancels the patch.
- Patch notes are anchored metadata, not essay text.
- Cursor entering a patched range expands patch preview; moving away collapses it into a small marker/chip.
- Bottom Highlight Key must remain visible.
- Add top module progress bar and action progress indicator for Refresh / Generate / Assist / Translate.
- Each module must save independently.
- Each module must have a clear but safe Delete/Clear Current Module button. Before deletion, snapshot the module and ask for confirmation.

## Data model principles

Canonical module content:

```ts
text: string
annotations: Annotation[]
patches: Patch[]
snapshots: Snapshot[]
sources: SourceCard[]
```

Paragraphs use `\n\n`. Highlights are metadata annotations with `start` and `end` offsets. Generated content must never be stored as HTML or colored spans. Export/render transforms text + annotations into styled HTML.

Project JSON import/export must include:

- schema version
- topic/title/current module
- six independent module documents
- annotations
- patches
- snapshots
- sources/source cards
- assistant history if useful
- timestamps

Project JSON must never include API keys.

## AI routes

Required server-side routes:

- `POST /api/refresh`: classify text ranges; do not rewrite text.
- `POST /api/generate-next`: generate Module N+1 from Module N using transition-specific prompts.
- `POST /api/assist`: contextual assistant for selected text/range and current module.
- `POST /api/translate`: bilingual translation; implement after core is done and committed.

The DeepSeek API key belongs only in `.env.local` as `DEEPSEEK_API_KEY`. Never expose it through `NEXT_PUBLIC_`.

If no API key exists, use deterministic mock AI so the demo remains usable.

## Prompt registry

Store editable transition prompts in:

```text
src/lib/moduleTransitionPrompts.ts
docs/MODULE_TRANSITION_PROMPTS.md
```

Each module transition must have its own prompt, input contract, output contract, validation rules, paragraph-format rules, citation behavior, and failure behavior.

## Academic integrity and citation policy

Never invent real citations, authors, years, titles, DOIs, URLs, journals, or reference entries. If source material is missing:

- insert `[citation needed]`,
- add an `issue` annotation,
- add a source-search suggestion,
- or create a source card placeholder.

Only generate a formatted citation when the user supplied the source metadata or the app verified it through a source lookup feature. If source lookup is not implemented yet, provide manual source cards and citation-gap marking first.

## Visual target

Use these reference images as the visual direction, not pixel-perfect templates:

- `public/reference-images/mockup-1-dashboard.png`
- `public/reference-images/mockup-2-drafting-workspace.png`

Target style:

- clean off-white paper background
- crayon/marker-style EssayCraft title
- soft pastel annotation colors
- left module pipeline
- top module progress bar
- central highlighted editor with paragraph spacing
- right AI Assistant and snapshots
- bottom Highlight Key
- practical, student-friendly, stable

## Finish modal

If `public/assets/essaycraft-finish-photo.jpg` exists, show it in the Module 6 export/download finish modal. Do not identify the people in the photo. Use this text:

> Inspired by John-Paul Grima's argumentative essay journey.

## Definition of done

The product is done only when:

- app runs locally
- editing is smooth
- paragraph breaks are preserved in editor, generated modules, copy, HTML export, JSON export/import
- progress bar works
- each module saves independently
- clear/delete current module works with confirmation and snapshot
- colors render correctly
- patches work with Ctrl/Cmd+Enter
- refresh preserves text and updates labels
- Generate Next works for all five transitions
- each transition has a dedicated editable prompt
- AI Assistant works with preview/apply/dismiss
- citation/source workbench is usable and does not hallucinate sources
- JSON import/export works
- HTML/rich copy/export works
- snapshots and restore work
- Translate works after core commit
- Module 6 export finish modal works
- typecheck/lint/build pass
- no API keys are committed
- final summary is complete
