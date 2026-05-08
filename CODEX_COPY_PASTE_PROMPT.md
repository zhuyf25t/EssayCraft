You are Codex working on this repository:

https://github.com/zhuyf25t/EssayCraft.git

Your mission is to build EssayCraft into a polished, stable, practical AI-assisted academic essay workflow editor. Treat this as an autonomous product-engineering run, not a single small ticket. Do not stop after planning. Keep implementing, testing, using the product, finding the next weakness, and improving it until the acceptance criteria pass or an external blocker prevents progress.

## 0. Start with Git

Run:

```bash
git status
git remote -v
git branch --show-current
git pull --rebase origin main || git pull --rebase origin master || true
git checkout -b feat/essaycraft-autonomous-evolution || git checkout feat/essaycraft-autonomous-evolution
```

If the repo is empty, create the project from scratch using Next.js + TypeScript + Tailwind. If files already exist, read and improve them.

## 1. Read project context first

Read these before editing:

```text
AGENTS.md
README_START_HERE.md
README.md
CODEX_AUTONOMOUS_EVOLUTION_PROMPT.md
docs/PRD.md
docs/MODULE_WORKFLOW.md
docs/MODULE_TRANSITION_PROMPTS.md
docs/PARAGRAPH_AND_TEXT_FORMAT_SPEC.md
docs/EDITOR_UX_SPEC.md
docs/PROGRESS_BAR_SPEC.md
docs/MODULE_STATE_AND_DELETE_SPEC.md
docs/CITATION_SOURCE_WORKBENCH_SPEC.md
docs/AI_ASSISTANT_SPEC.md
docs/TRANSLATE_SPEC.md
docs/VISUAL_TARGET.md
docs/SELF_EVOLUTION_PROTOCOL.md
docs/ACCEPTANCE_CRITERIA.md
docs/NIGHT_RUN_CHECKLIST.md
docs/ACADEMIC_INTEGRITY.md
docs/API_SPEC.md
docs/DATA_MODEL.md
docs/TEST_PLAN.md
```

Inspect visual references:

```text
public/reference-images/mockup-1-dashboard.png
public/reference-images/mockup-2-drafting-workspace.png
```

Inspect Module 6 finish asset:

```text
public/assets/essaycraft-finish-photo.jpg
```

Do not identify people in the photo. Use it only as a finish modal asset with this line:

```text
Inspired by John-Paul Grima's argumentative essay journey.
```

## 2. Use subagents if available

Spawn these project subagents in parallel if supported, wait for their findings, then consolidate:

1. `product_architect`
   - audit six-module workflow, acceptance criteria, module transition prompts, UX decisions, unclear product choices.
2. `ux_editor_engineer`
   - design/build smooth editor, paragraph preservation, highlight overlay, patch UX, module progress, clear module, copy/export.
3. `ai_backend_engineer`
   - implement DeepSeek-compatible routes, JSON mode, validation, prompt registry, mock fallback, assist/translate.
4. `citation_source_architect`
   - design citation/source workbench, source cards, citation-needed labels, no-hallucination behavior, Module 5 checks.
5. `qa_experience_tester`
   - run app, smoke-test as student, inspect bugs, build/lint/typecheck, secret leaks, UX edge cases.
6. `visual_polish_designer`
   - move UI toward reference mockups: crayon title, pastel highlights, left module pipeline, right assistant, bottom Highlight Key.
7. `docs_maintainer`
   - keep docs updated with actual implementation decisions.

If subagents are unavailable, emulate these roles sequentially in the main thread.

## 3. Product target

Build EssayCraft:

- six-module AI-assisted academic essay workflow editor
- local-first MVP, no database
- server-side AI routes only
- smooth text editor with color-coded rhetorical annotations
- patch notes like PDF comments, but keyboard-friendly
- module-to-module generation with snapshots
- AI Assistant with preview/apply
- citation/source workbench that never invents sources
- JSON import/export and HTML/rich text export
- Translate button as final phase
- visual target close in spirit to the provided mockups

Modules:

1. Module 1: Topic & Question
2. Module 2: Research & Evidence
3. Module 3: Outline
4. Module 4: Drafting
5. Module 5: Referencing / Citation Check
6. Module 6: Final Review / Conclusion / Export

## 4. Required layout

Build a single-page app with:

- left sidebar module pipeline: Module 1–6, current highlighted
- top header: crayon/marker-style EssayCraft title, topic input, Module N of 6
- top module progress bar: checked/completed/current/future states
- top toolbar: Previous, Next, Generate Next Module, Refresh Highlighting, Save Snapshot, Clear Module, Copy Rich Text, Download HTML, Download JSON, Import JSON, Reset Demo, Translate
- central editor: large writing area with paragraph spacing and colored highlights
- right panel: AI Assistant, suggestion preview/apply, snapshot/version history, source/citation workbench where useful
- bottom fixed Highlight Key

Visual style:

- off-white paper background
- simple, clean, student-friendly
- pastel highlighter colors
- slightly hand-drawn/crayon EssayCraft title
- not overdecorated
- close to `public/reference-images/mockup-1-dashboard.png` and `public/reference-images/mockup-2-drafting-workspace.png`

## 5. Editor architecture — very important

The earlier MVP had bad editing because it glued sentence spans together. Fix this.

Use canonical plain text + annotation ranges:

```ts
type ModuleDocument = {
  moduleNumber: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  snapshots: Snapshot[];
  sources: SourceCard[];
  updatedAt: string;
};
```

Paragraphs must be preserved with `\n\n`. Do not collapse paragraphs.

Do not store generated content as HTML, JSX, colored spans, or one span per sentence. Use a robust editor approach:

- preferred: textarea + synchronized highlight backdrop
- acceptable: robust editor library if lightweight and stable
- avoid fragile inline contentEditable spans unless fully tested

Highlight rendering must be based on annotation ranges, not the source text itself.

## 6. Paragraph requirements

The generated text must be readable and separated by module type:

- Module 1: concise planning text with short headings if helpful
- Module 2: research/evidence plan with headings and bullets
- Module 3: outline with headings and bullets
- Module 4: full paragraph prose with blank lines between paragraphs
- Module 5: preserved draft paragraphs plus separate citation checklist/workbench
- Module 6: final essay paragraphs plus editing/proofreading/conclusion checklist

All outputs should store blank lines as `\n\n`. HTML export should convert paragraphs to `<p>` blocks. JSON export/import must preserve paragraph breaks exactly.

## 7. Patch UX

Keyboard behavior:

- `Ctrl+Enter` / `Cmd+Enter` opens patch for current sentence or selected range.
- If patch box is open, `Ctrl+Enter` / `Cmd+Enter` saves and closes.
- `Shift+Enter` inside patch inserts newline.
- `Esc` cancels patch.

Patch placeholder:

```text
Tell the AI what to fix here...
```

Patch behavior:

- Patch notes are metadata, not essay text.
- Patch anchors should use selected range offsets and optionally exact selected text.
- Cursor entering a patched range expands the patch preview.
- Cursor leaving collapses it into a small marker/chip.
- Refresh sends patches to AI so the user can correct highlight errors or request rewrites.

## 8. Module state, save, delete

Each module is independently saved. Switching modules must never lose content.

Required:

- auto-save current project locally
- Save Snapshot for current module
- Snapshot before Generate Next target overwrite
- Clear/Delete Current Module button
- Clear Module must confirm, snapshot first, then clear only current module
- Restore from snapshot panel
- Reset Demo is separate and resets the whole demo only after confirmation

## 9. Progress bar

Add two progress layers:

1. Module progress at top:
   - completed modules with checkmarks if they have content
   - current module highlighted
   - future modules muted
   - clickable steps

2. Action progress/status:
   - Refresh: Reading text → Classifying ranges → Updating colors
   - Generate Next: Saving snapshot → Generating → Validating JSON → Applying module
   - Assist: Preparing context → Drafting suggestion → Preview ready
   - Translate: Preparing → Translating → Preview ready

MVP can use status chips/spinner; better version can use progress steps.

## 10. Prompt registry

Create/maintain:

```text
src/lib/moduleTransitionPrompts.ts
docs/MODULE_TRANSITION_PROMPTS.md
```

Each transition must have an independent prompt, structure, validation rules, paragraph rules, and citation behavior.

Required transitions:

- 1→2 Topic & Question → Research & Evidence
- 2→3 Research & Evidence → Outline
- 3→4 Outline → Drafting
- 4→5 Drafting → Referencing / Citation Check
- 5→6 Referencing / Citation Check → Final Review / Export

Each transition must return JSON with:

```json
{
  "moduleNumber": 4,
  "title": "Drafting",
  "text": "Paragraph 1...\n\nParagraph 2...",
  "annotations": [
    {
      "id": "a1",
      "start": 0,
      "end": 80,
      "text": "exact substring",
      "label": "background",
      "confidence": 0.88,
      "comment": "..."
    }
  ],
  "sources": [],
  "globalFeedback": [],
  "warnings": []
}
```

Validate that annotation ranges match the returned text. If validation fails, repair or fall back gracefully.

## 11. AI/API requirements

Create server-side routes:

```text
POST /api/refresh
POST /api/generate-next
POST /api/assist
POST /api/translate
```

Use DeepSeek-compatible OpenAI-style API. Environment variables:

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
```

Rules:

- API key only in `.env.local`.
- Never expose key with `NEXT_PUBLIC_`.
- Use JSON mode / JSON output when calling DeepSeek.
- Include the word `json` and an example JSON output in prompts.
- Set reasonable max_tokens to avoid truncation.
- If no API key, deterministic mock AI must keep demo usable.
- Validate responses before applying.
- Never silently corrupt user text.

## 12. Refresh Highlighting

`/api/refresh` should:

- receive current module text, annotations, patches, topic, sources
- preserve exact text
- classify rhetorical function ranges
- identify citation gaps and weak structure as `issue`
- return annotations/comments/global feedback
- never rewrite the text

## 13. Generate Next

`/api/generate-next` should:

- receive source module number, source module text, annotations, patches, topic, sources
- use the correct transition prompt from registry
- generate target module text with paragraphs appropriate to the module
- return target module with annotations and warnings
- not invent sources
- use `[citation needed]` for missing evidence
- target module snapshot before overwrite
- switch to target after success

## 14. AI Assistant

Right panel must include selected text awareness and quick actions:

- Explain this highlight
- Relabel selected sentence/range
- Rewrite selected passage
- Make more academic
- Strengthen analysis
- Find citation gaps
- Apply suggestion
- Apply and refresh
- Translate selected/current module

Assistant behavior:

- Suggestions preview before applying.
- Apply snapshots first.
- Dismiss does not change text.
- Assistant should explain what changed.
- Assistant should not perform destructive global edits without confirmation.

## 15. Citation/source workbench

Build a pragmatic MVP first:

- manual source cards
- citation-needed markers
- source/citation checklist in Module 5
- distinguish supplied/verified source data from missing/unverified source data
- show issue annotations for unsupported factual claims

Never fabricate sources.

Source cards should support:

```ts
id, title, authors, year, containerTitle, publisher, doi, url, sourceType, credibilityNotes, userNotes, verified, createdAt
```

Module 5 should treat citation as two halves:

- in-text citation
- reference list entry

If automatic source search is not ready, do not block. Provide manual source card and source-search suggestions.

## 16. JSON import/export

Implement:

- Download JSON for entire project
- Import JSON for entire project
- validate schema version
- preserve six independent module documents
- preserve paragraph breaks
- preserve annotations, patches, snapshots, sources
- never include API keys
- show friendly errors if import fails

## 17. HTML / rich copy export

Implement:

- Copy Rich Text for current module: text with highlight colors and paragraphs
- Download HTML for current project or current module
- Module 6 Download HTML shows finish modal with photo if present
- HTML export should include Highlight Key and basic metadata

## 18. Translate — final phase only

After core workflow, editor, assistant, citation, export, and visual polish are working and committed, add Translate.

Translate requirements:

- Translate selected text
- Translate current module
- English → Chinese
- Chinese → English
- side-by-side preview
- no automatic overwrite
- Apply snapshots first
- preserve or refresh labels after applying
- `/api/translate` with mock fallback

## 19. Visual polish target

After core works, polish toward the reference images:

- crayon/marker EssayCraft title
- left module pipeline cards
- central paper-like editor
- soft highlighter colors
- right AI Assistant panel
- snapshot/source cards
- bottom Highlight Key
- subtle borders/shadows
- practical and not overly decorative

## 20. Validation commands

Run repeatedly:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

If tests exist, run them. If scripts are missing, create them. Fix failures and rerun.

## 21. Smoke test checklist

Manually test, using app/UI tools if available:

1. Open app.
2. Edit Module 1 text.
3. Preserve paragraph breaks with blank lines.
4. Switch modules and back; content persists.
5. Add patch with Ctrl/Cmd+Enter.
6. Patch Ctrl/Cmd+Enter saves; Shift+Enter makes newline; Esc cancels.
7. Refresh Highlighting; text remains identical; colors update.
8. Generate Module 2 from Module 1; target snapshots first and opens.
9. Continue Generate Next through Module 6.
10. Module 4 appears as paragraphs, not glued sentences.
11. Save snapshot and restore.
12. Clear Module with confirmation; restore from snapshot.
13. Use AI Assistant quick action; preview/apply/dismiss works.
14. Add source card; Module 5 marks citation gaps without fake citations.
15. Download JSON; import JSON; project restores.
16. Copy Rich Text and Download HTML preserve highlights and paragraphs.
17. Module 6 Download HTML opens finish modal with photo and John-Paul line.
18. Translate selected/current module preview works.
19. Reload browser; local state persists.
20. Reset Demo asks confirmation and works.
21. Inspect git diff for secrets.

## 22. Autonomous continuation rule

If all explicit items above appear done, do not immediately stop. Run the self-evolution loop from `docs/SELF_EVOLUTION_PROTOCOL.md`:

- re-read docs and mockups
- experience the product
- identify weakest remaining issue
- improve it
- validate
- commit
- repeat

Stop only when acceptance criteria pass and you can honestly state that the product is stable, useful, and close to the intended mockup experience.

## 23. Commit plan

Commit milestones:

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

git push -u origin feat/essaycraft-autonomous-evolution || true
```

## 24. Final response

At the end, report:

- branch name
- commit hashes/messages
- implemented features
- key files changed
- commands run and results
- manual smoke tests performed
- how to configure `.env.local`
- known limitations
- confirmation that no API key was committed
- what Codex improved during self-evolution after the first implementation

Keep working until validation passes or an external blocker prevents progress. If blocked, commit the best working state and explain exactly what remains.
