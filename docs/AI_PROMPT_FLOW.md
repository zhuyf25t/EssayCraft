# EssayCraft AI Prompt Flow

This file documents what EssayCraft sends to the AI provider. Editable system prompts live in the root `prompts/` directory.

## Editable prompt files

- `prompts/shared/course-workflow.md`
- `prompts/assist/system.md`
- `prompts/refresh/unit-label-system.md`
- `prompts/refresh/revision-system.md`
- `prompts/refresh/range-annotation-system.md`
- `prompts/translate/system.md`
- `prompts/generate-next/system-suffix.md`
- `prompts/generate-next/annotation-rules.md`
- `prompts/generate-next/schema-repair-system.md`
- `prompts/generate-next/contract-repair-system.md`
- `prompts/repair/json-system.md`

The TypeScript code builds user prompts and fills variables such as `{{expectedKind}}`, `{{labelRules}}`, `{{unitCount}}`, and `{{courseWorkflowContext}}`.

## `/api/assist`

Used by Chat and Edit actions:

- Chat
- Rewrite
- Academic
- Analyze
- Translate from Edit mode
- Explain

System prompt:

- `prompts/assist/system.md`

User prompt includes:

- project title
- topic/context
- current module number and title
- requested action
- selected range
- selected text
- notes inside selected/active range
- full current module text
- annotations
- patches
- relevant open notes
- sources
- recent assistant history, last six messages

Reason: Edit actions need selected text, but the provider also needs enough module context to follow project title, stage purpose, and nearby essay logic.

## `/api/refresh`

### Normal Refresh Highlighting

System prompt:

- `prompts/refresh/unit-label-system.md`

User prompt includes:

- project title
- topic/context
- current module number
- full essay context
- optional local refresh instruction
- sentence/rhetorical units to label, each with index/start/end/text

Normal Refresh does not send patches, sources, or existing annotations.

Current cost note: the full text appears once as context and again inside `units[].text`. This improves alignment and sentence-level labeling, but it increases prompt tokens.

### Apply Notes & Refresh

Only used when open unresolved patches/notes exist.

System prompt:

- `prompts/refresh/revision-system.md`

User prompt includes:

- project title
- topic/context
- current module number
- current essay text
- temporary revision notes
- existing annotations
- source cards

This path returns a revision preview. It does not overwrite text until the user accepts.

## `/api/generate-next`

System prompt:

- transition-specific prompt from `src/lib/moduleTransitionPrompts.ts`
- plus `prompts/generate-next/system-suffix.md`

User prompt includes:

- topic
- source module number
- target module number
- source title
- source text
- source annotations
- source patches
- source cards
- teacher-editable transition instruction
- annotation label rules from `prompts/generate-next/annotation-rules.md`

Repair prompts:

- schema repair: `prompts/generate-next/schema-repair-system.md`
- contract repair: `prompts/generate-next/contract-repair-system.md`

## `/api/translate`

This route is used for standalone/reference translation, not the Edit-mode Translate button.

System prompt:

- `prompts/translate/system.md`

User prompt includes:

- topic
- module number
- selected range if any
- text to translate

The route scopes text to the selected range before building the prompt.

## Generic JSON repair

When provider output is invalid JSON or fails schema validation for task-router tasks, EssayCraft sends one repair request with:

- `prompts/repair/json-system.md`
- original task context
- schema/validation error
- previous raw output

This repair is why a single user action can sometimes count as two provider calls.
